"""Background workers for crawl, embed, and reindex jobs."""

import asyncio
import uuid

import structlog
from arq import create_pool
from arq.connections import RedisSettings

from gtm_api.config import get_settings
from gtm_api.database import async_session_factory
from gtm_api.models import Source
from gtm_api.services.ingestion import ingest_source
from gtm_api.services.learning import refresh_product

settings = get_settings()
logger = structlog.get_logger()


async def crawl_source(ctx: dict, source_id: str, tenant_id: str, product_id: str) -> dict:
    async with async_session_factory() as db:
        source = await db.get(Source, uuid.UUID(source_id))
        if not source:
            return {"error": "Source not found"}
        result = await ingest_source(
            db, source, uuid.UUID(tenant_id), uuid.UUID(product_id)
        )
        await db.commit()
        logger.info("crawl_complete", source_id=source_id, result=result)
        return result


async def refresh_product_knowledge(ctx: dict, product_id: str, tenant_id: str) -> dict:
    async with async_session_factory() as db:
        result = await refresh_product(db, uuid.UUID(product_id), uuid.UUID(tenant_id))
        await db.commit()
        logger.info("refresh_complete", product_id=product_id)
        return result


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    functions = [crawl_source, refresh_product_knowledge]
    max_jobs = 10
    job_timeout = 600


async def enqueue_crawl(source_id: str, tenant_id: str, product_id: str) -> str:
    redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    job = await redis.enqueue_job("crawl_source", source_id, tenant_id, product_id)
    return job.job_id if job else ""


def main():
    from arq.worker import run_worker
    run_worker(WorkerSettings)
