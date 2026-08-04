"""MCP Context Hub — aggregate multiple inputs for LLM decisions."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.config import get_settings
from gtm_api.database import async_session_factory
from gtm_api.models import Product
from gtm_api.services.mcp.external_client import fetch_external_mcp_context
from gtm_api.services.mcp.internal_providers import (
    provider_analytics,
    provider_brief,
    provider_crm,
    provider_leads,
    provider_profile,
    provider_rag,
)
from gtm_api.services.mcp.types import DecisionContext

DEFAULT_PROVIDERS = ("rag", "profile", "crm", "analytics", "brief", "leads")


async def _collect_blocks(
    session: AsyncSession,
    query: str,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
    *,
    product: Product | None,
    profile: dict | None,
    wanted: list[str],
    include_external_mcp: bool,
) -> DecisionContext:
    settings = get_settings()
    ctx = DecisionContext(query=query)

    if product is None:
        product = await session.get(Product, product_id)

    if "rag" in wanted:
        block, results = await provider_rag(tenant_id, product_id, query)
        ctx.search_results = results
        if block:
            ctx.blocks.append(block)

    if "profile" in wanted:
        block = await provider_profile(product, profile)
        if block:
            ctx.blocks.append(block)

    if "crm" in wanted:
        block = await provider_crm(session, tenant_id, product_id)
        if block:
            ctx.blocks.append(block)

    if "analytics" in wanted:
        block = await provider_analytics(session, tenant_id, product_id)
        if block:
            ctx.blocks.append(block)

    if "brief" in wanted and product:
        block = await provider_brief(session, tenant_id, product)
        if block:
            ctx.blocks.append(block)

    if "leads" in wanted:
        block = await provider_leads(session, product_id, tenant_id)
        if block:
            ctx.blocks.append(block)

    if include_external_mcp and settings.mcp_servers_list():
        external_blocks = await fetch_external_mcp_context(
            query,
            settings.mcp_servers_list(),
            timeout_seconds=settings.mcp_timeout_seconds,
        )
        ctx.blocks.extend(external_blocks)

    if len(ctx.blocks) > settings.mcp_max_blocks:
        ctx.blocks = ctx.blocks[: settings.mcp_max_blocks]

    return ctx


async def gather_decision_context(
    query: str,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
    *,
    db: AsyncSession | None = None,
    product: Product | None = None,
    profile: dict | None = None,
    providers: list[str] | None = None,
    include_external_mcp: bool | None = None,
) -> DecisionContext:
    """
    Collect context from multiple sources (internal platform + optional external MCP).
    Used before LLM calls so agents decide with richer, labeled inputs.
    """
    settings = get_settings()
    if not settings.mcp_context_enabled:
        block, results = await provider_rag(tenant_id, product_id, query)
        ctx = DecisionContext(query=query, search_results=results)
        if block:
            ctx.blocks.append(block)
        return ctx

    wanted = providers or settings.mcp_context_providers_list()
    use_external = (
        include_external_mcp
        if include_external_mcp is not None
        else settings.mcp_external_enabled
    )

    if db is not None:
        return await _collect_blocks(
            db,
            query,
            tenant_id,
            product_id,
            product=product,
            profile=profile,
            wanted=wanted,
            include_external_mcp=use_external,
        )

    async with async_session_factory() as session:
        return await _collect_blocks(
            session,
            query,
            tenant_id,
            product_id,
            product=product,
            profile=profile,
            wanted=wanted,
            include_external_mcp=use_external,
        )


def list_available_providers() -> list[dict]:
    settings = get_settings()
    internal = [
        {"id": "rag", "type": "internal", "description": "Vector search over ingested docs"},
        {"id": "profile", "type": "internal", "description": "Product profile JSON"},
        {"id": "crm", "type": "internal", "description": "Pipeline opportunities and stages"},
        {"id": "analytics", "type": "internal", "description": "30-day funnel and metrics"},
        {"id": "brief", "type": "internal", "description": "Executive brief narrative and risks"},
        {"id": "leads", "type": "internal", "description": "Top qualified leads"},
    ]
    external = [
        {"id": s.get("name", "mcp"), "type": "external", "transport": s.get("type", "stdio")}
        for s in settings.mcp_servers_list()
    ]
    return internal + external
