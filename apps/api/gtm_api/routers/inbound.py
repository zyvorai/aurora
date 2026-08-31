"""Inbound lead capture and routing."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import get_current_user, require_permission
from gtm_api.database import get_db
from gtm_api.models import Product, User
from gtm_api.schemas import (
    InboundEmbedConfigResponse,
    InboundLeadRequest,
    InboundLeadResponse,
    PublicInboundLeadRequest,
    SequenceListResponse,
    SequenceStepInput,
    UpdateSequenceRequest,
    UpdateSequenceResponse,
)
from gtm_api.services.inbound_routing import ingest_inbound_lead
from gtm_api.services.inbound_tokens import inbound_token, verify_inbound_token
from gtm_api.services.sequences import list_product_sequences, update_outreach_sequence
from gtm_api.tenant import get_product_for_tenant, get_tenant_context

router = APIRouter(tags=["inbound"])


@router.get("/products/{product_id}/inbound/embed", response_model=InboundEmbedConfigResponse)
async def get_inbound_embed_config(
    product_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return embed key + snippet for a public lead capture form."""
    ctx = await get_tenant_context(user, db)
    product = await get_product_for_tenant(db, product_id, ctx.tenant_id)
    key = inbound_token(str(product.id))
    return InboundEmbedConfigResponse(
        product_id=str(product.id),
        product_name=product.name,
        embed_key=key,
        form_fields=["email", "name", "company", "title", "phone"],
    )


@router.post("/public/inbound", response_model=InboundLeadResponse)
async def capture_public_inbound_lead(
    req: PublicInboundLeadRequest,
    db: AsyncSession = Depends(get_db),
):
    """Public lead capture — authenticate with embed_key (no JWT required)."""
    if not req.email.strip():
        raise HTTPException(status_code=400, detail="Email is required")
    if not verify_inbound_token(req.product_id, req.embed_key):
        raise HTTPException(status_code=403, detail="Invalid embed key")

    try:
        product_uuid = uuid.UUID(req.product_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid product_id") from exc

    result = await db.execute(select(Product).where(Product.id == product_uuid, Product.is_active.is_(True)))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    lead_result = await ingest_inbound_lead(
        db,
        product,
        product.tenant_id,
        email=req.email,
        name=req.name,
        company=req.company,
        phone=req.phone,
        title=req.title,
        domain=req.domain,
        utm_source=req.utm_source,
        utm_campaign=req.utm_campaign,
        utm_medium=req.utm_medium,
    )
    await db.commit()
    return InboundLeadResponse(**lead_result)


@router.post("/products/{product_id}/inbound", response_model=InboundLeadResponse)
async def capture_inbound_lead(
    product_id: uuid.UUID,
    req: InboundLeadRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Capture an inbound lead: enrich → score → assign rep → optional CRM sync.

    Authenticate with JWT or X-API-Key (for embedded forms / webhooks).
    """
    ctx = await get_tenant_context(user, db)
    product = await get_product_for_tenant(db, product_id, ctx.tenant_id)

    if not req.email.strip():
        raise HTTPException(status_code=400, detail="Email is required")

    result = await ingest_inbound_lead(
        db,
        product,
        ctx.tenant_id,
        email=req.email,
        name=req.name,
        company=req.company,
        phone=req.phone,
        title=req.title,
        domain=req.domain,
        utm_source=req.utm_source,
        utm_campaign=req.utm_campaign,
        utm_medium=req.utm_medium,
    )
    await db.commit()
    return InboundLeadResponse(**result)


@router.get("/products/{product_id}/sequences", response_model=SequenceListResponse)
async def list_sequences(
    product_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    sequences = await list_product_sequences(db, product_id, ctx.tenant_id)
    return SequenceListResponse(sequences=sequences)


@router.put("/products/{product_id}/artifacts/{artifact_id}/sequence", response_model=UpdateSequenceResponse)
async def update_sequence(
    product_id: uuid.UUID,
    artifact_id: uuid.UUID,
    req: UpdateSequenceRequest,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    try:
        result = await update_outreach_sequence(
            db,
            product_id,
            ctx.tenant_id,
            artifact_id,
            [s.model_dump() for s in req.steps],
            recipient=req.recipient,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    await db.commit()
    return UpdateSequenceResponse(**result)
