"""Sales, outreach, architect, and proposal routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import get_current_user, require_permission
from gtm_api.database import async_session_factory, get_db
from gtm_api.models import Artifact, User
from gtm_api.schemas import (
    ArchitectRequest,
    ArchitectResponse,
    ChatRequest,
    ChatResponse,
    Citation,
    OutreachRequest,
    OutreachResponse,
    ProposalRequest,
    ProposalResponse,
    AnalyticsResponse,
)
from gtm_api.agents.sales_agent import run_sales_chat
from gtm_api.agents.outreach import run_outreach
from gtm_api.agents.solution_architect import invoke_solution_architect, run_solution_architect
from gtm_api.agents.proposal_generator import run_proposal_generator
from gtm_api.agents.supervisor import run_supervisor
from gtm_api.config import get_settings
from gtm_api.services.analytics import get_analytics
from gtm_api.services.job_queue import enqueue_product_refresh
from gtm_api.services.learning import refresh_product
from gtm_api.services.enterprise import get_audit_trail, add_suppression
from gtm_api.services.proposal_export import EXPORT_RENDERERS
from gtm_api.tenant import get_product_for_tenant, get_tenant_context, record_usage

settings = get_settings()

router = APIRouter(tags=["agents"])


@router.post("/products/{product_id}/chat", response_model=ChatResponse)
async def sales_chat(
    product_id: uuid.UUID,
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    product = await db.get(
        __import__("gtm_api.models", fromlist=["Product"]).Product, product_id
    )
    if not product:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Product not found")

    result = await run_sales_chat(db, product, product.tenant_id, req.message, req.session_id)
    return ChatResponse(**result)


@router.post("/products/{product_id}/outreach", response_model=OutreachResponse)
async def generate_outreach(
    product_id: uuid.UUID,
    req: OutreachRequest,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    product = await get_product_for_tenant(db, product_id, ctx.tenant_id)
    artifact = await run_outreach(
        db, product, ctx.tenant_id, user.id,
        req.company_url, req.target_persona, req.campaign_name,
    )
    meta = artifact.metadata_ or {}
    return OutreachResponse(
        artifact_id=artifact.id,
        company_name=meta.get("company_name", ""),
        company_analysis=meta.get("company_analysis", {}),
        pain_points=meta.get("pain_points", []),
        product_fit=meta.get("product_fit", ""),
        email_draft=meta.get("email_draft", artifact.content),
        follow_up_sequence=meta.get("follow_up_sequence", []),
        citations=[],
    )


@router.post("/products/{product_id}/architect", response_model=ArchitectResponse)
async def solution_architect(
    product_id: uuid.UUID,
    req: ArchitectRequest,
    user: User = Depends(get_current_user),
):
    async with async_session_factory() as db:
        ctx = await get_tenant_context(user, db)
        product = await get_product_for_tenant(db, product_id, ctx.tenant_id)
        profile = dict(product.profile or {})
        tenant_id = ctx.tenant_id
        pid = product.id

    result = await invoke_solution_architect(pid, tenant_id, profile, req.question, req.context)
    tokens_used = result.pop("tokens_used", 0)
    result.pop("security_notes", None)

    async with async_session_factory() as db:
        await record_usage(db, tenant_id, tokens=tokens_used, agent_runs=1)
        await db.commit()

    return ArchitectResponse(**result)


@router.post("/products/{product_id}/proposals", response_model=ProposalResponse)
async def generate_proposal(
    product_id: uuid.UUID,
    req: ProposalRequest,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    product = await get_product_for_tenant(db, product_id, ctx.tenant_id)
    artifact = await run_proposal_generator(
        db, product, ctx.tenant_id, user.id, req.scope, req.include_pricing,
    )
    meta = artifact.metadata_ or {}
    return ProposalResponse(
        artifact_id=artifact.id,
        title=meta.get("title", artifact.title),
        proposal_content=meta.get("proposal_content", ""),
        sow=meta.get("sow", ""),
        roi_analysis=meta.get("roi_analysis", ""),
        pricing=meta.get("pricing"),
        timeline=meta.get("timeline", ""),
        citations=[],
        sources_used=meta.get("sources_used", []),
    )


@router.get("/products/{product_id}/proposals/{artifact_id}/export")
async def export_proposal(
    product_id: uuid.UUID,
    artifact_id: uuid.UUID,
    format: str = "pdf",
    user: User = Depends(require_permission("read")),
    db: AsyncSession = Depends(get_db),
):
    if format not in EXPORT_RENDERERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{format}'. Use one of: {', '.join(EXPORT_RENDERERS)}",
        )

    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    result = await db.execute(
        select(Artifact).where(
            Artifact.id == artifact_id,
            Artifact.product_id == product_id,
            Artifact.tenant_id == ctx.tenant_id,
        )
    )
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Proposal artifact not found")

    render, content_type = EXPORT_RENDERERS[format]
    try:
        file_bytes = render(artifact)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Export failed: {exc}")

    filename = f"proposal-{artifact_id}.{format}"
    return StreamingResponse(
        iter([file_bytes]),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/products/{product_id}/analytics", response_model=AnalyticsResponse)
async def product_analytics(
    product_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    data = await get_analytics(db, ctx.tenant_id, product_id)
    return AnalyticsResponse(**data)


@router.post("/products/{product_id}/refresh")
async def refresh_knowledge(
    product_id: uuid.UUID,
    async_mode: bool = True,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    if async_mode and settings.redis_workers_enabled:
        job_id = await enqueue_product_refresh(product_id, ctx.tenant_id)
        if job_id:
            return {
                "status": "queued",
                "job_id": job_id,
                "message": "Refresh queued — poll product sources for status",
            }
        # Workers unavailable — fall through to synchronous refresh

    result = await refresh_product(db, product_id, ctx.tenant_id)
    return result


@router.get("/agents/registry")
async def list_agent_registry(
    user: User = Depends(get_current_user),
):
    from gtm_api.agents.registry import list_agents

    return [
        {
            "agent_id": spec.agent_id,
            "display_name": spec.display_name,
            "compute_tier": spec.compute_tier.value,
            "async_required": spec.async_required,
            "implemented": spec.implemented,
            "model_key": spec.model_key,
            "description": spec.description,
        }
        for spec in list_agents()
    ]


@router.post("/products/{product_id}/supervisor")
async def supervisor_route(
    product_id: uuid.UUID,
    request_type: str,
    input_data: dict = {},
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    product = await get_product_for_tenant(db, product_id, ctx.tenant_id)
    result = await run_supervisor(db, product, ctx.tenant_id, user.id, request_type, input_data)
    return result


@router.get("/audit")
async def audit_trail(
    user: User = Depends(require_permission("read")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    logs = await get_audit_trail(db, ctx.tenant_id)
    return [
        {
            "id": str(log.id),
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]
