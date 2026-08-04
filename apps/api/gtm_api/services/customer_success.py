"""Customer Success service — T0 health scoring + scheduled CS briefs."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import AccountHealth, Opportunity, OpportunityActivity

HEALTH_STATUSES = ("healthy", "at_risk", "churned")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def collect_health_metrics(
    db: AsyncSession,
    opportunity: Opportunity,
    tenant_id: uuid.UUID,
) -> dict:
    """SQL-only engagement signals for an account."""
    activity_count = await db.execute(
        select(func.count(OpportunityActivity.id)).where(
            OpportunityActivity.opportunity_id == opportunity.id,
            OpportunityActivity.tenant_id == tenant_id,
        )
    )
    days_in_stage = 0
    if opportunity.updated_at:
        delta = _utcnow() - opportunity.updated_at.replace(tzinfo=timezone.utc)
        days_in_stage = max(0, delta.days)

    return {
        "stage": opportunity.stage,
        "activity_count": activity_count.scalar() or 0,
        "days_in_stage": days_in_stage,
        "has_proposal": opportunity.proposal_artifact_id is not None,
        "amount": opportunity.amount,
    }


def score_health(metrics: dict) -> tuple[float, str]:
    """Rules-first health score — no LLM."""
    score = 50.0
    stage = metrics.get("stage", "discovery")
    if stage == "closed_won":
        score += 30
    elif stage in ("negotiation", "proposal"):
        score += 15
    elif stage == "closed_lost":
        score = 10.0

    activity_count = metrics.get("activity_count", 0)
    score += min(activity_count * 5, 20)

    if metrics.get("has_proposal"):
        score += 5

    days = metrics.get("days_in_stage", 0)
    if stage == "closed_won" and days > 60:
        score -= 10
    if stage not in ("closed_won", "closed_lost") and days > 90:
        score -= 15

    score = max(0.0, min(100.0, score))
    if score >= 70:
        status = "healthy"
    elif score >= 40:
        status = "at_risk"
    else:
        status = "churned"
    return score, status


def build_playbook(opportunity: Opportunity, metrics: dict) -> dict:
    """T0 adoption playbook — no LLM."""
    company = opportunity.company or opportunity.name
    steps = [
        {"week": 1, "action": f"Kickoff call with {company}", "owner": "CSM"},
        {"week": 2, "action": "Verify product onboarding checklist complete", "owner": "CSM"},
        {"week": 4, "action": "Review usage metrics and adoption blockers", "owner": "CSM"},
    ]
    if metrics.get("activity_count", 0) < 2:
        steps.insert(0, {"week": 0, "action": "Schedule re-engagement outreach", "owner": "AE"})
    if opportunity.stage == "closed_won":
        steps.append({"week": 8, "action": "QBR prep — ROI review and expansion discussion", "owner": "CSM"})
    return {
        "account": company,
        "stage": opportunity.stage,
        "steps": steps,
        "renewal_focus": opportunity.stage == "closed_won",
    }


def build_cs_brief(opportunity: Opportunity, metrics: dict, health_score: float, status: str) -> dict:
    """Structured CS brief for scheduled delivery."""
    company = opportunity.company or opportunity.name
    narrative = (
        f"{company} health score {health_score:.0f}/100 ({status}). "
        f"{metrics.get('activity_count', 0)} activities logged; "
        f"{metrics.get('days_in_stage', 0)} days in current stage."
    )
    recommendations: list[str] = []
    if status == "at_risk":
        recommendations.append("Schedule executive check-in within 7 days")
        recommendations.append("Review blockers from last opportunity activity")
    elif status == "healthy" and opportunity.stage == "closed_won":
        recommendations.append("Prepare QBR deck with usage and ROI metrics")
        recommendations.append("Identify expansion opportunities")
    else:
        recommendations.append("Continue standard onboarding cadence")

    return {
        "account": company,
        "health_score": health_score,
        "status": status,
        "narrative": narrative,
        "recommendations": recommendations,
        "metrics": metrics,
        "generated_at": _utcnow().isoformat(),
        "compute_tier": "T0",
    }


async def upsert_account_health(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
    opportunity: Opportunity,
    *,
    playbook: dict | None = None,
    cs_brief: dict | None = None,
) -> AccountHealth:
    metrics = await collect_health_metrics(db, opportunity, tenant_id)
    score, status = score_health(metrics)

    result = await db.execute(
        select(AccountHealth).where(AccountHealth.opportunity_id == opportunity.id)
    )
    record = result.scalar_one_or_none()
    if record:
        record.health_score = score
        record.status = status
        record.metrics = metrics
        if playbook is not None:
            record.playbook = playbook
        if cs_brief is not None:
            record.cs_brief = cs_brief
            record.last_cs_brief_at = _utcnow()
    else:
        record = AccountHealth(
            tenant_id=tenant_id,
            product_id=product_id,
            opportunity_id=opportunity.id,
            health_score=score,
            status=status,
            metrics=metrics,
            playbook=playbook or {},
            cs_brief=cs_brief or {},
            last_cs_brief_at=_utcnow() if cs_brief else None,
        )
        db.add(record)
    await db.flush()
    return record


async def build_success_plan(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
    opportunity: Opportunity,
) -> dict:
    metrics = await collect_health_metrics(db, opportunity, tenant_id)
    score, status = score_health(metrics)
    playbook = build_playbook(opportunity, metrics)
    cs_brief = build_cs_brief(opportunity, metrics, score, status)
    record = await upsert_account_health(
        db, tenant_id, product_id, opportunity, playbook=playbook, cs_brief=cs_brief
    )
    return {
        "opportunity_id": str(opportunity.id),
        "health_score": record.health_score,
        "status": record.status,
        "playbook": record.playbook,
        "cs_brief": record.cs_brief,
    }


async def list_account_health(
    db: AsyncSession,
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> list[AccountHealth]:
    result = await db.execute(
        select(AccountHealth)
        .where(
            AccountHealth.product_id == product_id,
            AccountHealth.tenant_id == tenant_id,
        )
        .order_by(AccountHealth.health_score.asc())
    )
    return list(result.scalars().all())


async def refresh_cs_briefs_for_product(
    db: AsyncSession,
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> dict:
    """Refresh CS briefs for closed-won and active opportunities."""
    result = await db.execute(
        select(Opportunity).where(
            Opportunity.product_id == product_id,
            Opportunity.tenant_id == tenant_id,
            Opportunity.stage.in_(("closed_won", "negotiation", "proposal")),
        )
    )
    opps = list(result.scalars().all())
    refreshed = 0
    for opp in opps:
        await build_success_plan(db, tenant_id, product_id, opp)
        refreshed += 1
    return {"refreshed": refreshed, "product_id": str(product_id)}


def account_health_to_dict(record: AccountHealth) -> dict:
    return {
        "id": str(record.id),
        "opportunity_id": str(record.opportunity_id),
        "health_score": record.health_score,
        "status": record.status,
        "metrics": record.metrics or {},
        "playbook": record.playbook or {},
        "cs_brief": record.cs_brief or {},
        "last_cs_brief_at": record.last_cs_brief_at.isoformat() if record.last_cs_brief_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }
