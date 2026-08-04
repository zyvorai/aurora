"""Product insights — SQL-first analytics + weekly LLM narrative cache."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.config import get_settings
from gtm_api.models import Campaign, DashboardSnapshot, Opportunity, Product
from gtm_api.services.analytics import get_analytics
from gtm_api.services.brief import upsert_dashboard_snapshot
from gtm_api.services.llm import get_chat_model
from gtm_api.tenant import record_usage

settings = get_settings()
WEEKLY_SNAPSHOT_TYPE = "weekly_insights"
NARRATIVE_MAX_AGE_DAYS = 7


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def get_extended_analytics(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
    days: int = 30,
) -> dict:
    """SQL aggregates including pipeline and campaign metrics."""
    base = await get_analytics(db, tenant_id, product_id, days=days)

    opp_by_stage = await db.execute(
        select(Opportunity.stage, func.count(Opportunity.id))
        .where(
            Opportunity.product_id == product_id,
            Opportunity.tenant_id == tenant_id,
        )
        .group_by(Opportunity.stage)
    )
    pipeline = {row[0]: row[1] for row in opp_by_stage.all()}

    weighted = await db.execute(
        select(func.sum(Opportunity.amount * Opportunity.probability)).where(
            Opportunity.product_id == product_id,
            Opportunity.tenant_id == tenant_id,
            Opportunity.stage.notin_(("closed_won", "closed_lost")),
        )
    )

    campaign_count = await db.execute(
        select(func.count(Campaign.id)).where(
            Campaign.product_id == product_id,
            Campaign.tenant_id == tenant_id,
        )
    )
    active_campaigns = await db.execute(
        select(func.count(Campaign.id)).where(
            Campaign.product_id == product_id,
            Campaign.tenant_id == tenant_id,
            Campaign.status.in_(("active", "needs_attention")),
        )
    )

    base["pipeline"] = {
        "by_stage": pipeline,
        "total_opportunities": sum(pipeline.values()),
        "weighted_value": round(weighted.scalar() or 0.0, 2),
    }
    base["campaigns"] = {
        "total": campaign_count.scalar() or 0,
        "active": active_campaigns.scalar() or 0,
    }
    base["compute_tier"] = "T0"
    return base


async def _get_weekly_snapshot(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
) -> DashboardSnapshot | None:
    result = await db.execute(
        select(DashboardSnapshot).where(
            DashboardSnapshot.tenant_id == tenant_id,
            DashboardSnapshot.product_id == product_id,
            DashboardSnapshot.snapshot_type == WEEKLY_SNAPSHOT_TYPE,
        )
    )
    return result.scalar_one_or_none()


def _snapshot_is_fresh(snapshot: DashboardSnapshot | None) -> bool:
    if not snapshot or not snapshot.updated_at:
        return False
    updated = snapshot.updated_at.replace(tzinfo=timezone.utc)
    return (_utcnow() - updated) < timedelta(days=NARRATIVE_MAX_AGE_DAYS)


async def get_product_insights(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
) -> dict:
    """T0 read — SQL metrics + cached weekly narrative if available."""
    analytics = await get_extended_analytics(db, tenant_id, product_id)
    snapshot = await _get_weekly_snapshot(db, tenant_id, product_id)
    narrative_llm = None
    narrative_updated_at = None
    if snapshot and snapshot.data:
        narrative_llm = snapshot.data.get("narrative_llm")
        narrative_updated_at = snapshot.data.get("updated_at")
    return {
        **analytics,
        "narrative_llm": narrative_llm,
        "narrative_fresh": _snapshot_is_fresh(snapshot),
        "narrative_updated_at": narrative_updated_at,
    }


async def generate_weekly_narrative(
    product: Product,
    analytics: dict,
) -> tuple[str, int]:
    """LLM insight — intended max 1×/week via worker or explicit refresh."""
    llm = get_chat_model("analytics", temperature=0.3)
    prompt = f"""Write a 3-sentence executive GTM insight for {product.name}.

Metrics (last 30 days):
{json.dumps({k: v for k, v in analytics.items() if k not in ('narrative_llm', 'narrative_fresh', 'narrative_updated_at')}, indent=2)}

Focus on pipeline health, campaign activity, and top recommendation. Be concise."""

    response = await llm.ainvoke([
        {"role": "system", "content": "You are a RevOps analyst. Ground insights in the data provided."},
        {"role": "user", "content": prompt},
    ])
    return response.content.strip(), 500


async def refresh_weekly_insights(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
    *,
    force: bool = False,
) -> dict:
    """Generate or return cached weekly narrative."""
    product = await db.get(Product, product_id)
    if not product:
        return {"error": "Product not found"}

    snapshot = await _get_weekly_snapshot(db, tenant_id, product_id)
    if not force and _snapshot_is_fresh(snapshot):
        data = snapshot.data if snapshot else {}
        return {
            "refreshed": False,
            "cached": True,
            "narrative_llm": data.get("narrative_llm"),
            "updated_at": data.get("updated_at"),
        }

    analytics = await get_extended_analytics(db, tenant_id, product_id)
    narrative, tokens = await generate_weekly_narrative(product, analytics)
    updated_at = _utcnow().isoformat()
    payload = {
        "narrative_llm": narrative,
        "analytics_summary": {
            "pipeline": analytics.get("pipeline"),
            "campaigns": analytics.get("campaigns"),
            "funnel": analytics.get("funnel"),
        },
        "updated_at": updated_at,
    }
    await upsert_dashboard_snapshot(db, tenant_id, product_id, payload, WEEKLY_SNAPSHOT_TYPE)

    exec_snapshot = await db.execute(
        select(DashboardSnapshot).where(
            DashboardSnapshot.tenant_id == tenant_id,
            DashboardSnapshot.product_id == product_id,
            DashboardSnapshot.snapshot_type == "executive_brief",
        )
    )
    exec_brief = exec_snapshot.scalar_one_or_none()
    if exec_brief and exec_brief.data:
        merged = dict(exec_brief.data)
        merged["narrative_llm"] = narrative
        exec_brief.data = merged

    await record_usage(db, tenant_id, tokens=tokens, agent_runs=1)
    await db.flush()
    return {
        "refreshed": True,
        "cached": False,
        "narrative_llm": narrative,
        "updated_at": updated_at,
        "tokens_used": tokens,
    }
