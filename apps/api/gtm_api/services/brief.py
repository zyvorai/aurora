"""Executive brief builder — Tier 0 (SQL only, no LLM)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import (
    Artifact,
    ArtifactType,
    DashboardSnapshot,
    Lead,
    Product,
    Source,
    SourceStatus,
)
from gtm_api.services.analytics import get_analytics


def _build_narrative(
    product: Product,
    gtm_readiness: dict,
    kpis: dict,
    risks: list[str],
) -> str:
    parts = [f"{product.name} GTM status:"]
    if gtm_readiness["profile_built"]:
        parts.append("product profile is ready.")
    else:
        parts.append("product profile is not built yet.")
    if gtm_readiness["strategy_ready"]:
        parts.append("GTM strategy exists.")
    else:
        parts.append("GTM strategy pending.")
    if kpis["leads"] > 0:
        parts.append(f"{kpis['leads']} leads in pipeline.")
    if kpis["conversations"] > 0:
        parts.append(f"{kpis['conversations']} sales conversations logged.")
    if risks:
        parts.append(f"Attention: {risks[0]}.")
    return " ".join(parts)


async def build_executive_brief(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product: Product,
) -> dict:
    """Assemble executive brief from SQL aggregates — zero LLM calls."""
    analytics = await get_analytics(db, tenant_id, product.id, days=30)

    source_rows = await db.execute(
        select(func.count(Source.id)).where(
            Source.product_id == product.id,
            Source.tenant_id == tenant_id,
        )
    )
    completed_sources = await db.execute(
        select(func.count(Source.id)).where(
            Source.product_id == product.id,
            Source.tenant_id == tenant_id,
            Source.status == SourceStatus.COMPLETED,
        )
    )
    strategy_count = await db.execute(
        select(func.count(Artifact.id)).where(
            Artifact.product_id == product.id,
            Artifact.tenant_id == tenant_id,
            Artifact.artifact_type == ArtifactType.STRATEGY,
        )
    )
    outreach_count = await db.execute(
        select(func.count(Artifact.id)).where(
            Artifact.product_id == product.id,
            Artifact.tenant_id == tenant_id,
            Artifact.artifact_type == ArtifactType.OUTREACH,
        )
    )
    lead_count = await db.execute(
        select(func.count(Lead.id)).where(
            Lead.product_id == product.id,
            Lead.tenant_id == tenant_id,
        )
    )

    profile_built = product.profile_status == "ready" and bool(product.profile)
    strategy_ready = (strategy_count.scalar() or 0) > 0
    sources_total = source_rows.scalar() or 0
    sources_done = completed_sources.scalar() or 0

    gtm_readiness = {
        "ingest_started": sources_total > 0,
        "ingest_complete": sources_total > 0 and sources_done == sources_total,
        "profile_built": profile_built,
        "strategy_ready": strategy_ready,
        "outreach_ready": (outreach_count.scalar() or 0) > 0,
    }

    kpis = {
        "leads": lead_count.scalar() or 0,
        "conversations": analytics["funnel"].get("conversations", 0),
        "artifacts": analytics["funnel"].get("artifacts_created", 0),
        "agent_runs": analytics["funnel"].get("agent_runs", 0),
    }

    risks: list[str] = []
    if not gtm_readiness["ingest_complete"] and sources_total > 0:
        risks.append("Ingestion still in progress")
    if not profile_built:
        risks.append("Product profile not built — run Crawl & Ingest then Build Profile")
    if profile_built and not strategy_ready:
        risks.append("GTM strategy not generated")
    if kpis["leads"] == 0:
        risks.append("No leads in pipeline yet")

    narrative = _build_narrative(product, gtm_readiness, kpis, risks)

    brief = {
        "product_id": str(product.id),
        "product_name": product.name,
        "profile_status": product.profile_status,
        "gtm_readiness": gtm_readiness,
        "kpis": kpis,
        "funnel": analytics["funnel"],
        "metrics": analytics["metrics"],
        "narrative": narrative,
        "risks": risks,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "compute_tier": "T0",
    }

    snapshot_result = await db.execute(
        select(DashboardSnapshot).where(
            DashboardSnapshot.tenant_id == tenant_id,
            DashboardSnapshot.product_id == product.id,
            DashboardSnapshot.snapshot_type == "executive_brief",
        )
    )
    snapshot = snapshot_result.scalar_one_or_none()
    stored_narrative = (snapshot.data or {}).get("narrative_llm") if snapshot else None
    if not stored_narrative:
        weekly = await db.execute(
            select(DashboardSnapshot).where(
                DashboardSnapshot.tenant_id == tenant_id,
                DashboardSnapshot.product_id == product.id,
                DashboardSnapshot.snapshot_type == "weekly_insights",
            )
        )
        weekly_snap = weekly.scalar_one_or_none()
        if weekly_snap and weekly_snap.data:
            stored_narrative = weekly_snap.data.get("narrative_llm")
    if stored_narrative:
        brief["narrative_llm"] = stored_narrative

    return brief


async def upsert_dashboard_snapshot(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
    data: dict,
    snapshot_type: str = "executive_brief",
) -> DashboardSnapshot:
    result = await db.execute(
        select(DashboardSnapshot).where(
            DashboardSnapshot.tenant_id == tenant_id,
            DashboardSnapshot.product_id == product_id,
            DashboardSnapshot.snapshot_type == snapshot_type,
        )
    )
    snapshot = result.scalar_one_or_none()
    if snapshot:
        snapshot.data = data
    else:
        snapshot = DashboardSnapshot(
            tenant_id=tenant_id,
            product_id=product_id,
            snapshot_type=snapshot_type,
            data=data,
        )
        db.add(snapshot)
    await db.flush()
    return snapshot
