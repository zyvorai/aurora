"""Continuous Learning Engine (Phase 10)."""

import hashlib
import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import Artifact, Document, Product, Source, SourceStatus
from gtm_api.services.ingestion import ingest_source
from gtm_api.services.crawler import fetch_single_page

logger = structlog.get_logger()


async def check_source_changes(
    db: AsyncSession,
    source: Source,
) -> bool:
    if not source.url:
        return False
    try:
        page = await fetch_single_page(source.url)
        return page.content_hash != source.content_hash
    except Exception:
        return False


async def refresh_product(
    db: AsyncSession,
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> dict:
    result = await db.execute(
        select(Source).where(
            Source.product_id == product_id,
            Source.tenant_id == tenant_id,
        )
    )
    sources = result.scalars().all()

    refreshed = []
    for source in sources:
        changed = await check_source_changes(db, source)
        if changed:
            source.status = SourceStatus.PENDING
            source.content_hash = None
            r = await ingest_source(db, source, tenant_id, product_id)
            refreshed.append({"source_id": str(source.id), **r})

    stale_artifacts = await db.execute(
        select(Artifact).where(
            Artifact.product_id == product_id,
            Artifact.tenant_id == tenant_id,
        )
    )
    stale_count = len(stale_artifacts.scalars().all())

    return {
        "sources_refreshed": len(refreshed),
        "refresh_details": refreshed,
        "stale_artifacts_flagged": stale_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def refresh_all_active_products(db: AsyncSession) -> dict:
    """Sweep every active product and refresh it. Safe to run frequently: refresh_product
    already no-ops per-source when check_source_changes() finds no content drift, so this
    is the "scheduled" half of Phase 10 — the per-source staleness check already existed,
    it just was never invoked on a schedule."""
    result = await db.execute(select(Product).where(Product.is_active.is_(True)))
    products = result.scalars().all()

    refreshed_count = 0
    failures = []
    for product in products:
        try:
            outcome = await refresh_product(db, product.id, product.tenant_id)
            if outcome["sources_refreshed"] > 0:
                refreshed_count += 1
        except Exception as exc:
            logger.warning("scheduled_refresh_failed", product_id=str(product.id), error=str(exc))
            failures.append(str(product.id))

    return {
        "products_checked": len(products),
        "products_with_changes": refreshed_count,
        "failures": failures,
    }


async def detect_knowledge_gaps(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
) -> list[dict]:
    from gtm_api.models import MetricEvent

    result = await db.execute(
        select(MetricEvent)
        .where(
            MetricEvent.tenant_id == tenant_id,
            MetricEvent.product_id == product_id,
            MetricEvent.event_type == "ungrounded_blocked",
        )
        .order_by(MetricEvent.created_at.desc())
        .limit(20)
    )
    events = result.scalars().all()

    gaps = []
    seen = set()
    for event in events:
        query = event.event_data.get("query", "") if event.event_data else ""
        if query and query not in seen:
            seen.add(query)
            gaps.append({"query": query, "count": 1})

    return gaps
