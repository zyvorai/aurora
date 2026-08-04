"""Pipeline routes — market research, lead discovery, qualification."""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import content_hash, get_current_user, require_permission
from gtm_api.database import async_session_factory, get_db
from gtm_api.models import ApprovalStatus, Artifact, ArtifactType, Campaign, User
from gtm_api.schemas import (
    CampaignCreateRequest,
    CampaignResponse,
    DiscoverLeadsRequest,
    DiscoverLeadsResponse,
    MarketResearchRequest,
    MarketResearchResponse,
    QualifyLeadsRequest,
    QualifyLeadsResponse,
    PipelineLeadResponse,
)
from gtm_api.agents.market_research_agent import invoke_market_research
from gtm_api.services.lead_discovery import discover_leads, list_discovered_accounts
from gtm_api.services.lead_qualification import list_scored_leads, qualify_leads
from gtm_api.tenant import get_product_for_tenant, get_tenant_context, record_usage

router = APIRouter(tags=["pipeline"])


@router.post("/products/{product_id}/market-research", response_model=MarketResearchResponse)
async def run_market_research(
    product_id: uuid.UUID,
    req: MarketResearchRequest = MarketResearchRequest(),
    user: User = Depends(require_permission("write")),
):
    async with async_session_factory() as db:
        ctx = await get_tenant_context(user, db)
        product = await get_product_for_tenant(db, product_id, ctx.tenant_id)
        if not product.profile:
            raise HTTPException(status_code=400, detail="Build product profile first.")
        profile = dict(product.profile)
        tenant_id = ctx.tenant_id
        user_id = user.id
        pid = product.id
        product_name = product.name

    result = await invoke_market_research(pid, tenant_id, profile, req.focus_industries)
    brief = result["brief"]
    content = json.dumps(brief, indent=2)

    async with async_session_factory() as db:
        artifact = Artifact(
            product_id=pid,
            tenant_id=tenant_id,
            artifact_type=ArtifactType.MARKET_RESEARCH,
            title=f"Market Research - {product_name}",
            content=content,
            content_hash=content_hash(content),
            status=ApprovalStatus.DRAFT,
            metadata_=brief,
            created_by=user_id,
        )
        db.add(artifact)
        await record_usage(db, tenant_id, tokens=result.get("tokens_used", 0), agent_runs=1)
        await db.commit()
        await db.refresh(artifact)
        artifact_id = artifact.id

    return MarketResearchResponse(
        artifact_id=artifact_id,
        brief=brief,
        tokens_used=result.get("tokens_used", 0),
    )


@router.post("/products/{product_id}/discover-leads", response_model=DiscoverLeadsResponse)
async def run_discover_leads(
    product_id: uuid.UUID,
    req: DiscoverLeadsRequest = DiscoverLeadsRequest(),
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    product = await get_product_for_tenant(db, product_id, ctx.tenant_id)
    result = await discover_leads(
        db,
        product,
        ctx.tenant_id,
        focus_industries=req.focus_industries,
        max_leads=req.max_leads,
        csv_import=req.csv_import,
        geo=req.geo,
    )
    await db.commit()
    return DiscoverLeadsResponse(**result)


@router.post("/products/{product_id}/qualify-leads", response_model=QualifyLeadsResponse)
async def run_qualify_leads(
    product_id: uuid.UUID,
    req: QualifyLeadsRequest = QualifyLeadsRequest(),
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    product = await get_product_for_tenant(db, product_id, ctx.tenant_id)
    result = await qualify_leads(
        db,
        product,
        ctx.tenant_id,
        account_ids=req.account_ids,
        focus_industries=req.focus_industries,
    )
    await db.commit()
    return QualifyLeadsResponse(**result)


@router.get("/products/{product_id}/pipeline-leads", response_model=list[PipelineLeadResponse])
async def get_pipeline_leads(
    product_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    scored = await list_scored_leads(db, product_id, ctx.tenant_id)
    if scored:
        return [PipelineLeadResponse(**row) for row in scored]

    accounts = await list_discovered_accounts(db, product_id, ctx.tenant_id)
    return [
        PipelineLeadResponse(
            account_id=str(a.id),
            company_name=a.company_name,
            domain=a.domain,
            industry=a.industry,
            score=0,
            tier="—",
            explanation="Not yet qualified",
            factors={},
        )
        for a in accounts
    ]


@router.post("/products/{product_id}/campaigns", response_model=CampaignResponse)
async def create_campaign(
    product_id: uuid.UUID,
    req: CampaignCreateRequest,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    campaign = Campaign(
        product_id=product_id,
        tenant_id=ctx.tenant_id,
        name=req.name,
        campaign_type=req.campaign_type,
        status="draft",
        config={
            "template": req.template,
            "channels": req.channels,
            "focus_industries": req.focus_industries,
        },
    )
    db.add(campaign)
    await db.flush()
    return CampaignResponse(
        id=campaign.id,
        name=campaign.name,
        campaign_type=campaign.campaign_type,
        status=campaign.status,
        config=campaign.config or {},
    )


@router.get("/products/{product_id}/campaigns", response_model=list[CampaignResponse])
async def list_campaigns(
    product_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from gtm_api.models import Campaign as CampaignModel

    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    result = await db.execute(
        select(CampaignModel).where(
            CampaignModel.product_id == product_id,
            CampaignModel.tenant_id == ctx.tenant_id,
        ).order_by(CampaignModel.created_at.desc())
    )
    return [
        CampaignResponse(
            id=c.id,
            name=c.name,
            campaign_type=c.campaign_type,
            status=c.status,
            config=c.config or {},
        )
        for c in result.scalars().all()
    ]


@router.get("/products/{product_id}/campaigns/{campaign_id}/status")
async def get_campaign_monitor_status(
    product_id: uuid.UUID,
    campaign_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from gtm_api.services.campaign_monitor import get_campaign_status

    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    report = await get_campaign_status(db, campaign_id, ctx.tenant_id)
    if not report:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return report
