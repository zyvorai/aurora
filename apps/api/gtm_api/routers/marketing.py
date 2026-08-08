"""Marketing, content, and approval routes."""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import content_hash, get_current_user, require_permission
from gtm_api.database import async_session_factory, get_db
from gtm_api.models import Approval, ApprovalStatus, Artifact, ArtifactType, User
from gtm_api.schemas import (
    ApprovalRequest,
    ApprovalResponse,
    ContentRequest,
    ContentResponse,
    StrategyRequest,
    StrategyResponse,
    Citation,
    PublishRequest,
    PublishResponse,
)
from gtm_api.agents.marketing_strategy import invoke_marketing_strategy
from gtm_api.agents.content_studio import run_content_generation
from gtm_api.services.publishing import publish_artifact
from gtm_api.tenant import audit_log, get_product_for_tenant, get_tenant_context, record_usage

router = APIRouter(tags=["marketing"])


@router.post("/products/{product_id}/strategy", response_model=StrategyResponse)
async def generate_strategy(
    product_id: uuid.UUID,
    req: StrategyRequest = StrategyRequest(),
    user: User = Depends(require_permission("write")),
):
    async with async_session_factory() as db:
        ctx = await get_tenant_context(user, db)
        product = await get_product_for_tenant(db, product_id, ctx.tenant_id)
        if not product.profile:
            raise HTTPException(
                status_code=400,
                detail="Product profile is empty. Run Crawl & Ingest, then Build Product Profile first.",
            )
        profile = dict(product.profile)
        tenant_id = ctx.tenant_id
        user_id = user.id
        product_name = product.name
        pid = product.id

    # LLM step runs without an open DB connection (can take several minutes).
    result = await invoke_marketing_strategy(pid, tenant_id, profile, req.focus_areas)
    strategy = result["strategy"]
    content = json.dumps(strategy, indent=2)

    async with async_session_factory() as db:
        artifact = Artifact(
            product_id=pid,
            tenant_id=tenant_id,
            artifact_type=ArtifactType.STRATEGY,
            title=f"GTM Strategy - {product_name}",
            content=content,
            content_hash=content_hash(content),
            status=ApprovalStatus.DRAFT,
            metadata_=strategy,
            created_by=user_id,
        )
        db.add(artifact)
        await record_usage(db, tenant_id, tokens=result.get("tokens_used", 0), agent_runs=1)
        await db.commit()
        await db.refresh(artifact)
        artifact_id = artifact.id

    return StrategyResponse(
        artifact_id=artifact_id,
        gtm_strategy=strategy.get("gtm_strategy", ""),
        icp=strategy.get("icp", ""),
        personas=strategy.get("personas", []),
        positioning=strategy.get("positioning", ""),
        messaging_hierarchy=strategy.get("messaging_hierarchy", {}),
        value_propositions=strategy.get("value_propositions", []),
        objection_handling=strategy.get("objection_handling", []),
        competitive_comparison=strategy.get("competitive_comparison", []),
        seo_keywords=strategy.get("seo_keywords", []),
        content_calendar=strategy.get("content_calendar", []),
        citations=[],
        sources_used=result.get("sources_used", []),
    )


@router.post("/products/{product_id}/content", response_model=ContentResponse)
async def generate_content(
    product_id: uuid.UUID,
    req: ContentRequest,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    product = await get_product_for_tenant(db, product_id, ctx.tenant_id)
    artifact = await run_content_generation(
        db, product, ctx.tenant_id, user.id,
        req.content_type, req.topic, req.tone, req.target_persona,
    )

    return ContentResponse(
        artifact_id=artifact.id,
        title=artifact.title,
        content=artifact.content,
        citations=[Citation(**c) for c in (artifact.citations or [])],
        grounded=artifact.metadata_.get("grounded", False) if artifact.metadata_ else False,
        status=artifact.status.value,
    )


@router.get("/products/{product_id}/artifacts")
async def list_artifacts(
    product_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(Artifact).where(
            Artifact.product_id == product_id,
            Artifact.tenant_id == ctx.tenant_id,
        ).order_by(Artifact.created_at.desc())
    )
    artifacts = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "type": a.artifact_type.value,
            "title": a.title,
            "status": a.status.value,
            "channel": a.channel,
            "created_at": a.created_at.isoformat(),
        }
        for a in artifacts
    ]


@router.post("/artifacts/{artifact_id}/approve", response_model=ApprovalResponse)
async def approve_artifact(
    artifact_id: uuid.UUID,
    req: ApprovalRequest,
    user: User = Depends(require_permission("approve")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(Artifact).where(Artifact.id == artifact_id, Artifact.tenant_id == ctx.tenant_id)
    )
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    status = ApprovalStatus.APPROVED if req.status == "approved" else ApprovalStatus.REJECTED
    artifact.status = status

    approval = Approval(
        artifact_id=artifact.id,
        tenant_id=ctx.tenant_id,
        artifact_version=artifact.version,
        content_hash=artifact.content_hash,
        status=status,
        reviewer_id=user.id,
        comment=req.comment,
    )
    db.add(approval)
    await audit_log(db, ctx.tenant_id, user.id, f"artifact_{req.status}", "artifact", str(artifact_id))
    return approval


@router.post("/artifacts/{artifact_id}/publish", response_model=PublishResponse)
async def publish_content(
    artifact_id: uuid.UUID,
    req: PublishRequest,
    user: User = Depends(require_permission("publish")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(Artifact).where(Artifact.id == artifact_id, Artifact.tenant_id == ctx.tenant_id)
    )
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    try:
        post = await publish_artifact(
            db, artifact, ctx.tenant_id, user.id, req.channel, req.scheduled_at, req.recipient,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return PublishResponse(
        channel_post_id=post.id,
        status=post.status,
        idempotency_key=post.idempotency_key,
    )
