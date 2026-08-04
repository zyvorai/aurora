"""Internal context providers — platform data without external MCP."""

from __future__ import annotations

import json
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import Product
from gtm_api.services.analytics import get_analytics
from gtm_api.services.brief import build_executive_brief
from gtm_api.services.chunking import compact_profile, truncate_to_token_budget
from gtm_api.services.citation_gate import build_context_from_results
from gtm_api.services.crm import list_opportunities, pipeline_summary
from gtm_api.services.embeddings import embedding_service
from gtm_api.services.lead_qualification import list_scored_leads
from gtm_api.services.mcp.types import ContextBlock
from gtm_api.services.vector_store import vector_store


async def provider_rag(
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
    query: str,
    *,
    limit: int = 5,
) -> tuple[ContextBlock | None, list]:
    vector = await embedding_service.embed_query(query)
    results = await vector_store.search(tenant_id, product_id, vector, limit=limit)
    if not results:
        return None, results
    content = build_context_from_results(results, max_content_tokens=400)
    return (
        ContextBlock(
            source="internal",
            provider="rag",
            title="Product documentation (vector search)",
            content=content,
            metadata={"chunk_count": len(results)},
        ),
        results,
    )


async def provider_profile(product: Product | None, profile: dict | None) -> ContextBlock | None:
    data = profile or (product.profile if product else None)
    if not data:
        return None
    compact = compact_profile(dict(data))
    text = truncate_to_token_budget(json.dumps(compact, indent=2), 800)
    return ContextBlock(
        source="internal",
        provider="profile",
        title="Product profile",
        content=text,
        metadata={"profile_status": getattr(product, "profile_status", "unknown")},
    )


async def provider_crm(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
) -> ContextBlock | None:
    summary = await pipeline_summary(db, product_id, tenant_id)
    opps = await list_opportunities(db, product_id, tenant_id, limit=5)
    if summary["total"] == 0 and not opps:
        return None
    lines = [
        f"Open opportunities: {summary['total']}",
        f"Weighted pipeline: ${summary['weighted_pipeline']:,.0f}",
        f"By stage: {json.dumps(summary['by_stage'])}",
    ]
    for opp in opps[:5]:
        lines.append(f"- {opp.name} ({opp.company or 'n/a'}) · stage={opp.stage} · amount={opp.amount}")
    return ContextBlock(
        source="internal",
        provider="crm",
        title="CRM pipeline",
        content="\n".join(lines),
        metadata={"total": summary["total"]},
    )


async def provider_analytics(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
) -> ContextBlock | None:
    data = await get_analytics(db, tenant_id, product_id, days=30)
    funnel = data.get("funnel") or {}
    if not any(funnel.values()):
        return None
    return ContextBlock(
        source="internal",
        provider="analytics",
        title="GTM analytics (30d)",
        content=json.dumps({"funnel": funnel, "metrics": data.get("metrics", {})}, indent=2),
        metadata={"period": data.get("period")},
    )


async def provider_brief(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product: Product,
) -> ContextBlock | None:
    brief = await build_executive_brief(db, tenant_id, product)
    narrative = brief.get("narrative", "")
    risks = brief.get("risks") or []
    if not narrative and not risks:
        return None
    content = narrative
    if risks:
        content += "\n\nRisks:\n" + "\n".join(f"- {r}" for r in risks)
    return ContextBlock(
        source="internal",
        provider="brief",
        title="Executive brief",
        content=content,
        metadata={"compute_tier": brief.get("compute_tier", "T0")},
    )


async def provider_leads(
    db: AsyncSession,
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> ContextBlock | None:
    leads = await list_scored_leads(db, product_id, tenant_id)
    if not leads:
        return None
    lines = []
    for row in leads[:8]:
        lines.append(
            f"- {row.get('company_name')} tier={row.get('tier')} score={row.get('score', 0):.0f}"
        )
    return ContextBlock(
        source="internal",
        provider="leads",
        title="Qualified leads",
        content="\n".join(lines),
        metadata={"count": len(leads)},
    )
