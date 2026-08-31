"""Customer Success and insights routes (Wave 4)."""

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import get_current_user, require_permission
from gtm_api.config import get_settings
from gtm_api.database import async_session_factory, get_db
from gtm_api.models import User
from gtm_api.schemas import (
    AccountHealthResponse,
    AttributionSummaryResponse,
    InsightsResponse,
    SuccessPlanResponse,
    SyncStatusResponse,
)
from gtm_api.services.attribution import get_attribution_summary
from gtm_api.services.crm import get_opportunity
from gtm_api.services.crm_sync import sync_opportunities_to_external, sync_status
from gtm_api.services.customer_success import (
    account_health_to_dict,
    build_success_plan,
    list_account_health,
    refresh_cs_briefs_for_product,
)
from gtm_api.services.insights import get_product_insights, refresh_weekly_insights
from gtm_api.tenant import get_product_for_tenant, get_tenant_context

settings = get_settings()
router = APIRouter(tags=["success"])


async def _run_refresh_insights(product_id: uuid.UUID, tenant_id: uuid.UUID, force: bool) -> None:
    async with async_session_factory() as db:
        await refresh_weekly_insights(db, tenant_id, product_id, force=force)
        await db.commit()


@router.get("/products/{product_id}/insights", response_model=InsightsResponse)
async def product_insights(
    product_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """T0 SQL insights + cached weekly LLM narrative (no LLM on read)."""
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    data = await get_product_insights(db, ctx.tenant_id, product_id)
    return InsightsResponse(**data)


@router.post("/products/{product_id}/refresh-insights")
async def trigger_refresh_insights(
    product_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    force: bool = False,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    """Queue weekly narrative generation (LLM max 1×/week unless force=true)."""
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    if settings.redis_workers_enabled:
        background_tasks.add_task(_run_refresh_insights, product_id, ctx.tenant_id, force)
        return {"status": "queued", "message": "Weekly insights refresh queued"}

    result = await refresh_weekly_insights(db, ctx.tenant_id, product_id, force=force)
    await db.commit()
    return result


@router.get("/products/{product_id}/account-health", response_model=list[AccountHealthResponse])
async def get_account_health(
    product_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    records = await list_account_health(db, product_id, ctx.tenant_id)
    return [AccountHealthResponse(**account_health_to_dict(r)) for r in records]


@router.post(
    "/products/{product_id}/opportunities/{opportunity_id}/success-plan",
    response_model=SuccessPlanResponse,
)
async def create_success_plan(
    product_id: uuid.UUID,
    opportunity_id: uuid.UUID,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    opp = await get_opportunity(db, opportunity_id, ctx.tenant_id)
    if not opp or opp.product_id != product_id:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    plan = await build_success_plan(db, ctx.tenant_id, product_id, opp)
    await db.commit()
    return SuccessPlanResponse(**plan)


@router.post("/products/{product_id}/refresh-cs-briefs")
async def trigger_cs_brief_refresh(
    product_id: uuid.UUID,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    result = await refresh_cs_briefs_for_product(db, product_id, ctx.tenant_id)
    await db.commit()
    return result


@router.get("/products/{product_id}/attribution", response_model=AttributionSummaryResponse)
async def product_attribution(
    product_id: uuid.UUID,
    days: int = 30,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    data = await get_attribution_summary(db, ctx.tenant_id, product_id, days=days)
    return AttributionSummaryResponse(**data)


@router.get("/crm/sync-status", response_model=SyncStatusResponse)
async def get_crm_sync_status(user: User = Depends(get_current_user)):
    return SyncStatusResponse(**sync_status())


@router.post("/products/{product_id}/crm/sync")
async def trigger_crm_sync(
    product_id: uuid.UUID,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    result = await sync_opportunities_to_external(db, product_id, ctx.tenant_id)
    return result
