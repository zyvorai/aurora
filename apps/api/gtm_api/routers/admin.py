"""Tenant admin routes: plan usage, suppression list, data export/purge (Phase 12)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import require_permission
from gtm_api.database import get_db
from gtm_api.models import CustomWorkflowStage, Tenant, User
from gtm_api.schemas import (
    AddSuppressionRequest,
    AdminPlanResponse,
    PurgeRequest,
    PurgeResponse,
    SuppressionEntryResponse,
    WorkflowStageCreateRequest,
    WorkflowStageResponse,
    WorkflowStageUpdateRequest,
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

# Kept in sync with apps/web/src/lib/stage-icons.ts's ALLOWED_STAGE_ICONS keys and
# apps/web/src/components/layout/PageHero.tsx's Tone union -- a stage's icon/tone are
# plain strings validated against these fixed sets rather than a DB enum (see
# CustomWorkflowStage's docstring), but still rejected server-side if unrecognized so
# a direct API call can't store something the frontend can't safely render.
ALLOWED_STAGE_ICONS = {
    "layout-grid", "message-circle-question", "target", "file-text", "messages-square",
    "send", "blocks", "file-signature", "rocket", "bar-chart-3", "building-2", "users",
    "shield-check", "sparkles", "zap", "database", "globe", "compass", "handshake", "trending-up",
}
ALLOWED_STAGE_TONES = {"sky", "violet", "emerald", "amber", "pink", "teal", "rust"}
# The only agent actions a custom stage's `agent_action` block may invoke -- the same
# fixed set ForgePage.tsx's AgentTaskId/AGENT_TASK_CONFIG already cover. Not a way to
# define new backend behavior, just a tenant-preset invocation of an existing one.
ALLOWED_STAGE_ACTIONS = {"query", "strategy", "content", "outreach", "architect", "proposal", "analytics"}


def _validate_stage_fields(icon: str | None, tone: str | None, content_blocks: list[dict] | None) -> None:
    if icon is not None and icon not in ALLOWED_STAGE_ICONS:
        raise HTTPException(status_code=422, detail=f"Unknown icon '{icon}'")
    if tone is not None and tone not in ALLOWED_STAGE_TONES:
        raise HTTPException(status_code=422, detail=f"Unknown tone '{tone}'")
    if content_blocks is None:
        return
    agent_action_count = 0
    for block in content_blocks:
        block_type = block.get("type")
        if block_type not in {"markdown", "link", "callout", "agent_action"}:
            raise HTTPException(status_code=422, detail=f"Unknown block type '{block_type}'")
        if block_type == "agent_action":
            agent_action_count += 1
            if agent_action_count > 1:
                raise HTTPException(status_code=422, detail="A stage may have at most one agent_action block")
            if block.get("action") not in ALLOWED_STAGE_ACTIONS:
                raise HTTPException(status_code=422, detail=f"Unknown action '{block.get('action')}'")


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


# --- Custom workflow stages (tenant-defined Full Forge sidebar stages) ---

@router.get("/workflow-stages", response_model=list[WorkflowStageResponse])
async def list_workflow_stages(
    user: User = Depends(require_permission("read")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(CustomWorkflowStage)
        .where(CustomWorkflowStage.tenant_id == ctx.tenant_id)
        .order_by(CustomWorkflowStage.position)
    )
    return list(result.scalars().all())


@router.post("/workflow-stages", response_model=WorkflowStageResponse, status_code=201)
async def create_workflow_stage(
    req: WorkflowStageCreateRequest,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    tenant = await db.get(Tenant, ctx.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if not get_plan_features(tenant.plan.value)["custom_workflow_stages"]:
        raise HTTPException(status_code=403, detail="Custom workflow stages require the enterprise plan")

    _validate_stage_fields(req.icon, req.tone, req.content_blocks)
    stage = CustomWorkflowStage(
        tenant_id=ctx.tenant_id,
        group_label=req.group_label,
        label=req.label,
        icon=req.icon,
        tone=req.tone,
        position=req.position,
        content_blocks=req.content_blocks,
        created_by=user.id,
    )
    db.add(stage)
    await audit_log(db, ctx.tenant_id, user.id, "create_workflow_stage", "custom_workflow_stage")
    await db.flush()
    await db.refresh(stage)
    return stage


@router.put("/workflow-stages/{stage_id}", response_model=WorkflowStageResponse)
async def update_workflow_stage(
    stage_id: uuid.UUID,
    req: WorkflowStageUpdateRequest,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(CustomWorkflowStage).where(
            CustomWorkflowStage.id == stage_id, CustomWorkflowStage.tenant_id == ctx.tenant_id
        )
    )
    stage = result.scalar_one_or_none()
    if stage is None:
        raise HTTPException(status_code=404, detail="Workflow stage not found")

    _validate_stage_fields(req.icon, req.tone, req.content_blocks)
    for field in ("group_label", "label", "icon", "tone", "position", "content_blocks"):
        value = getattr(req, field)
        if value is not None:
            setattr(stage, field, value)

    await audit_log(
        db, ctx.tenant_id, user.id, "update_workflow_stage", "custom_workflow_stage",
        resource_id=str(stage_id),
    )
    await db.flush()
    await db.refresh(stage)
    return stage


@router.delete("/workflow-stages/{stage_id}", status_code=204)
async def delete_workflow_stage(
    stage_id: uuid.UUID,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(CustomWorkflowStage).where(
            CustomWorkflowStage.id == stage_id, CustomWorkflowStage.tenant_id == ctx.tenant_id
        )
    )
    stage = result.scalar_one_or_none()
    if stage is None:
        raise HTTPException(status_code=404, detail="Workflow stage not found")

    await db.delete(stage)
    await audit_log(
        db, ctx.tenant_id, user.id, "delete_workflow_stage", "custom_workflow_stage",
        resource_id=str(stage_id),
    )
    await db.flush()
