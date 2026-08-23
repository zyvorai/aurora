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


async def get_worker_status(max_jobs: int = 10) -> dict:
    """Live worker/queue counts for the console's rail footer, parsed from ARQ's own
    health-check key (`arq:queue:health-check`) rather than tracked separately --
    ARQ's worker process writes this itself every few seconds while running, in the
    form `j_complete=N j_failed=N j_retried=N j_ongoing=N queued=N`. Fails open (all
    zeros, `healthy=False`) if Redis is unreachable or no worker has checked in yet,
    matching this codebase's existing fail-open Redis convention (rate_limit.py)."""
    if not settings.redis_workers_enabled:
        return {"healthy": False, "ongoing": 0, "queued": 0, "idle": max_jobs, "max_jobs": max_jobs}
    try:
        redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
        raw = await redis.get("arq:queue:health-check")
    except Exception:
        return {"healthy": False, "ongoing": 0, "queued": 0, "idle": max_jobs, "max_jobs": max_jobs}
    if not raw:
        return {"healthy": False, "ongoing": 0, "queued": 0, "idle": max_jobs, "max_jobs": max_jobs}
    text = raw.decode() if isinstance(raw, bytes) else raw
    counts: dict[str, int] = {}
    for part in text.split():
        if "=" in part:
            key, _, value = part.partition("=")
            if value.isdigit():
                counts[key] = int(value)
    ongoing = counts.get("j_ongoing", 0)
    queued = counts.get("queued", 0)
    return {
        "healthy": True,
        "ongoing": ongoing,
        "queued": queued,
        "idle": max(max_jobs - ongoing, 0),
        "max_jobs": max_jobs,
    }
