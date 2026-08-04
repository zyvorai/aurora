"""MCP context hub API — inspect providers and preview aggregated context."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import get_current_user
from gtm_api.config import get_settings
from gtm_api.database import get_db
from gtm_api.models import User
from gtm_api.tenant import get_product_for_tenant, get_tenant_context
from gtm_api.services.mcp import gather_decision_context, list_available_providers

router = APIRouter(prefix="/mcp", tags=["mcp"])


@router.get("/status")
async def mcp_status(_user: User = Depends(get_current_user)):
    settings = get_settings()
    return {
        "enabled": settings.mcp_context_enabled,
        "external_enabled": settings.mcp_external_enabled,
        "providers": list_available_providers(),
        "active_providers": settings.mcp_context_providers_list(),
        "external_servers": len(settings.mcp_servers_list()),
        "max_blocks": settings.mcp_max_blocks,
    }


@router.get("/products/{product_id}/context")
async def preview_product_context(
    product_id: uuid.UUID,
    q: str = Query(..., min_length=3, max_length=2000),
    providers: str | None = Query(None, description="Comma-separated provider ids"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Preview multi-source context blocks for a query (no LLM call)."""
    ctx_tenant = await get_tenant_context(user, db)
    product = await get_product_for_tenant(db, product_id, ctx_tenant.tenant_id)
    provider_list = [p.strip() for p in providers.split(",") if p.strip()] if providers else None

    decision_ctx = await gather_decision_context(
        q,
        ctx_tenant.tenant_id,
        product_id,
        db=db,
        product=product,
        profile=product.profile,
        providers=provider_list,
    )
    return {
        **decision_ctx.to_dict(),
        "prompt_preview": decision_ctx.to_prompt_section(max_chars=4000),
    }
