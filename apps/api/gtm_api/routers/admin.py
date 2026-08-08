"""Tenant admin routes: plan usage, suppression list, data export/purge (Phase 12)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import require_permission
from gtm_api.database import get_db
from gtm_api.models import Tenant, User
from gtm_api.schemas import (
    AddSuppressionRequest,
    AdminPlanResponse,
    PurgeRequest,
    PurgeResponse,
    SuppressionEntryResponse,
)
from gtm_api.services.enterprise import (
    add_suppression,
    count_active_products,
    export_tenant_data,
    get_plan_features,
    list_suppressions,
    purge_tenant_data,
)
from gtm_api.tenant import audit_log, get_tenant_context

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/plan", response_model=AdminPlanResponse)
async def get_plan_usage(
    user: User = Depends(require_permission("read")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    tenant = await db.get(Tenant, ctx.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    features = get_plan_features(tenant.plan.value)
    used = await count_active_products(db, tenant.id)
    return AdminPlanResponse(
        plan=tenant.plan.value,
        tenant_slug=tenant.slug,
        features=features,
        usage={"products_used": used, "products_limit": features["products"]},
    )


@router.get("/suppression", response_model=list[SuppressionEntryResponse])
async def get_suppression_list(
    user: User = Depends(require_permission("read")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    entries = await list_suppressions(db, ctx.tenant_id)
    return entries


@router.post("/suppression", response_model=SuppressionEntryResponse, status_code=201)
async def add_suppression_entry(
    req: AddSuppressionRequest,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    try:
        entry = await add_suppression(db, ctx.tenant_id, req.email, req.reason)
        await audit_log(
            db, ctx.tenant_id, user.id, "suppress", "suppression_entry",
            details={"email": req.email},
        )
        await db.flush()
        await db.refresh(entry)
    except IntegrityError:
        raise HTTPException(status_code=409, detail=f"{req.email} is already suppressed")
    return entry


@router.get("/export")
async def export_data(
    user: User = Depends(require_permission("manage_tenant")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    data = await export_tenant_data(db, ctx.tenant_id)
    await audit_log(db, ctx.tenant_id, user.id, "export", "tenant", resource_id=str(ctx.tenant_id))
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": f'attachment; filename="tenant-export-{ctx.tenant_id}.json"'},
    )


@router.post("/purge", response_model=PurgeResponse)
async def purge_data(
    req: PurgeRequest,
    user: User = Depends(require_permission("manage_tenant")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    tenant = await db.get(Tenant, ctx.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if req.confirm != tenant.slug:
        raise HTTPException(status_code=400, detail="Confirmation does not match tenant slug")

    result = await purge_tenant_data(db, ctx.tenant_id)
    return PurgeResponse(status=result["status"], tenant_id=result["tenant_id"])
