"""CRM service — T0 pipeline (no LLM for stage moves)."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import OPPORTUNITY_STAGES, AccountHealth, Opportunity, OpportunityActivity

STAGE_PROBABILITY = {
    "discovery": 0.1,
    "qualification": 0.2,
    "technical_eval": 0.35,
    "proposal": 0.5,
    "negotiation": 0.7,
    "closed_won": 1.0,
    "closed_lost": 0.0,
}


async def create_opportunity(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
    *,
    name: str,
    company: str | None = None,
    stage: str = "discovery",
    lead_id: uuid.UUID | None = None,
    owner_id: uuid.UUID | None = None,
    amount: float | None = None,
    metadata: dict | None = None,
    proposal_artifact_id: uuid.UUID | None = None,
    architect_artifact_id: uuid.UUID | None = None,
) -> Opportunity:
    if stage not in OPPORTUNITY_STAGES:
        stage = "discovery"
    # Idempotent for seed re-runs: same name + company on the product returns existing.
    existing = await db.execute(
        select(Opportunity).where(
            Opportunity.tenant_id == tenant_id,
            Opportunity.product_id == product_id,
            Opportunity.name == name,
            Opportunity.company == company,
        ).limit(1)
    )
    found = existing.scalar_one_or_none()
    if found:
        return found
    opp = Opportunity(
        tenant_id=tenant_id,
        product_id=product_id,
        name=name,
        company=company,
        stage=stage,
        lead_id=lead_id,
        owner_id=owner_id,
        amount=amount,
        probability=STAGE_PROBABILITY.get(stage, 0.1),
        proposal_artifact_id=proposal_artifact_id,
        architect_artifact_id=architect_artifact_id,
        metadata_=metadata or {},
    )
    db.add(opp)
    await db.flush()
    return opp


async def update_opportunity_stage(
    db: AsyncSession,
    opportunity_id: uuid.UUID,
    tenant_id: uuid.UUID,
    stage: str,
    *,
    user_id: uuid.UUID | None = None,
) -> Opportunity | None:
    if stage not in OPPORTUNITY_STAGES:
        raise ValueError(f"Invalid stage: {stage}")
    opp = await db.get(Opportunity, opportunity_id)
    if not opp or opp.tenant_id != tenant_id:
        return None
    old_stage = opp.stage
    opp.stage = stage
    opp.probability = STAGE_PROBABILITY.get(stage, opp.probability)
    activity = OpportunityActivity(
        opportunity_id=opp.id,
        tenant_id=tenant_id,
        activity_type="stage_change",
        subject=f"Stage: {old_stage} → {stage}",
        body=None,
        created_by=user_id,
    )
    db.add(activity)
    await db.flush()
    return opp


async def add_opportunity_activity(
    db: AsyncSession,
    opportunity_id: uuid.UUID,
    tenant_id: uuid.UUID,
    *,
    activity_type: str,
    subject: str,
    body: str | None = None,
    user_id: uuid.UUID | None = None,
) -> OpportunityActivity | None:
    opp = await db.get(Opportunity, opportunity_id)
    if not opp or opp.tenant_id != tenant_id:
        return None
    activity = OpportunityActivity(
        opportunity_id=opportunity_id,
        tenant_id=tenant_id,
        activity_type=activity_type,
        subject=subject,
        body=body,
        created_by=user_id,
    )
    db.add(activity)
    await db.flush()
    return activity


async def list_opportunities(
    db: AsyncSession,
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
    *,
    stage: str | None = None,
    limit: int = 100,
) -> list[Opportunity]:
    query = select(Opportunity).where(
        Opportunity.product_id == product_id,
        Opportunity.tenant_id == tenant_id,
    )
    if stage:
        query = query.where(Opportunity.stage == stage)
    query = query.order_by(Opportunity.updated_at.desc()).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_opportunity(
    db: AsyncSession,
    opportunity_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> Opportunity | None:
    opp = await db.get(Opportunity, opportunity_id)
    if opp and opp.tenant_id == tenant_id:
        return opp
    return None


async def delete_opportunity(
    db: AsyncSession,
    opportunity_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> bool:
    opp = await get_opportunity(db, opportunity_id, tenant_id)
    if not opp:
        return False
    activities = await db.execute(
        select(OpportunityActivity).where(OpportunityActivity.opportunity_id == opportunity_id)
    )
    for act in activities.scalars().all():
        await db.delete(act)
    health = await db.execute(
        select(AccountHealth).where(AccountHealth.opportunity_id == opportunity_id)
    )
    for row in health.scalars().all():
        await db.delete(row)
    await db.delete(opp)
    await db.flush()
    return True


async def pipeline_summary(
    db: AsyncSession,
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> dict:
    result = await db.execute(
        select(Opportunity.stage, func.count(Opportunity.id))
        .where(
            Opportunity.product_id == product_id,
            Opportunity.tenant_id == tenant_id,
        )
        .group_by(Opportunity.stage)
    )
    by_stage = {row[0]: row[1] for row in result.all()}
    total = sum(by_stage.values())
    weighted = 0.0
    opps = await list_opportunities(db, product_id, tenant_id, limit=500)
    for opp in opps:
        weighted += (opp.amount or 0) * opp.probability
    return {
        "total": total,
        "by_stage": by_stage,
        "weighted_pipeline": round(weighted, 2),
    }


def opportunity_to_dict(opp: Opportunity) -> dict:
    return {
        "id": str(opp.id),
        "name": opp.name,
        "company": opp.company,
        "stage": opp.stage,
        "amount": opp.amount,
        "probability": opp.probability,
        "lead_id": str(opp.lead_id) if opp.lead_id else None,
        "proposal_artifact_id": str(opp.proposal_artifact_id) if opp.proposal_artifact_id else None,
        "architect_artifact_id": str(opp.architect_artifact_id) if opp.architect_artifact_id else None,
        "metadata": opp.metadata_ or {},
        "created_at": opp.created_at.isoformat() if opp.created_at else None,
        "updated_at": opp.updated_at.isoformat() if opp.updated_at else None,
    }
