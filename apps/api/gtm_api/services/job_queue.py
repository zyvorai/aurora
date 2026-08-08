"""Enqueue background ingest jobs via ARQ."""

from __future__ import annotations

import uuid
from typing import Optional

from arq import create_pool
from arq.connections import RedisSettings

from gtm_api.config import get_settings

settings = get_settings()


async def enqueue_source_ingest(
    source_id: uuid.UUID,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
) -> Optional[str]:
    if not settings.redis_workers_enabled:
        return None
    redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    job = await redis.enqueue_job(
        "crawl_source",
        str(source_id),
        str(tenant_id),
        str(product_id),
    )
    return job.job_id if job else None


async def enqueue_product_refresh(
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> Optional[str]:
    if not settings.redis_workers_enabled:
        return None
    redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    job = await redis.enqueue_job(
        "refresh_product_knowledge",
        str(product_id),
        str(tenant_id),
    )
    return job.job_id if job else None
