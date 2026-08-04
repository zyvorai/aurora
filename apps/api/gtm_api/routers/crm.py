"""CRM routes — T0 pipeline (no LLM for stage moves)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import get_current_user, require_permission
from gtm_api.database import get_db
from gtm_api.models import User
from gtm_api.schemas import (
    OpportunityCreateRequest,
    OpportunityResponse,
    OpportunityStageUpdate,
    PipelineSummaryResponse,
)
from gtm_api.services.crm import (
    create_opportunity,
    get_opportunity,
    list_opportunities,
    pipeline_summary,
    update_opportunity_stage,
)
from gtm_api.tenant import get_product_for_tenant, get_tenant_context

router = APIRouter(tags=["crm"])


def _to_response(opp) -> OpportunityResponse:
    return OpportunityResponse(
        id=opp.id,
        name=opp.name,
        company=opp.company,
        stage=opp.stage,
        amount=opp.amount,
        probability=opp.probability,
        lead_id=opp.lead_id,
        proposal_artifact_id=opp.proposal_artifact_id,
        architect_artifact_id=opp.architect_artifact_id,
        metadata=opp.metadata_ or {},
        created_at=opp.created_at,
        updated_at=opp.updated_at,
    )


@router.get("/products/{product_id}/opportunities", response_model=list[OpportunityResponse])
async def get_opportunities(
    product_id: uuid.UUID,
    stage: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    opps = await list_opportunities(db, product_id, ctx.tenant_id, stage=stage)
    return [_to_response(o) for o in opps]


@router.post("/products/{product_id}/opportunities", response_model=OpportunityResponse)
async def post_opportunity(
    product_id: uuid.UUID,
    req: OpportunityCreateRequest,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    opp = await create_opportunity(
        db,
        ctx.tenant_id,
        product_id,
        name=req.name,
        company=req.company,
        stage=req.stage,
        lead_id=req.lead_id,
        owner_id=user.id,
        amount=req.amount,
        metadata=req.metadata,
    )
    await db.commit()
    await db.refresh(opp)
    return _to_response(opp)


@router.get("/products/{product_id}/opportunities/{opportunity_id}", response_model=OpportunityResponse)
async def get_opportunity_detail(
    product_id: uuid.UUID,
    opportunity_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    opp = await get_opportunity(db, opportunity_id, ctx.tenant_id)
    if not opp or opp.product_id != product_id:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return _to_response(opp)


@router.patch(
    "/products/{product_id}/opportunities/{opportunity_id}/stage",
    response_model=OpportunityResponse,
)
async def patch_opportunity_stage(
    product_id: uuid.UUID,
    opportunity_id: uuid.UUID,
    req: OpportunityStageUpdate,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    try:
        opp = await update_opportunity_stage(
            db, opportunity_id, ctx.tenant_id, req.stage, user_id=user.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not opp or opp.product_id != product_id:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    await db.commit()
    await db.refresh(opp)
    return _to_response(opp)


@router.get("/products/{product_id}/pipeline-summary", response_model=PipelineSummaryResponse)
async def get_pipeline_summary(
    product_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    summary = await pipeline_summary(db, product_id, ctx.tenant_id)
    return PipelineSummaryResponse(**summary)
