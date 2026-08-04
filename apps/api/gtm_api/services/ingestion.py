"""Ingestion pipeline: load → chunk → embed → store."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import (
    Chunk,
    Document,
    Source,
    SourceProvenance,
    SourceStatus,
)
from gtm_api.services.chunking import chunk_text
from gtm_api.services.loaders import load_source_pages
from gtm_api.services.embeddings import embedding_service
from gtm_api.services.vector_store import vector_store
from gtm_api.tenant import record_usage


async def ingest_source(
    db: AsyncSession,
    source: Source,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
    *,
    force: bool = False,
) -> dict:
    source.status = SourceStatus.CRAWLING
    source.error_message = None
    await db.flush()

    try:
        pages = await load_source_pages(source, db)

        source.pages_discovered = len(pages)
        source.status = SourceStatus.PROCESSING
        await db.flush()

        if force:
            await _clear_source_documents(db, source, tenant_id)

        total_chunks = 0
        combined_hash = hashlib.sha256()

        for page in pages:
            combined_hash.update(page.content_hash.encode())

            if not force:
                existing = await db.execute(
                    select(Document).where(
                        Document.source_id == source.id,
                        Document.content_hash == page.content_hash,
                    )
                )
                if existing.scalar_one_or_none():
                    continue

            doc = Document(
                product_id=product_id,
                tenant_id=tenant_id,
                source_id=source.id,
                title=page.title,
                url=page.url,
                content_hash=page.content_hash,
                provenance=SourceProvenance.TENANT_AUTHORITATIVE,
                raw_content=page.content,
            )
            db.add(doc)
            await db.flush()

            text_chunks = chunk_text(page.content)
            embeddings_data = []

            for tc in text_chunks:
                chunk = Chunk(
                    document_id=doc.id,
                    product_id=product_id,
                    tenant_id=tenant_id,
                    content=tc.content,
                    content_hash=tc.content_hash,
                    chunk_index=tc.chunk_index,
                    token_count=tc.token_count,
                    qdrant_point_id=str(uuid.uuid4()),
                )
                db.add(chunk)
                await db.flush()
                embeddings_data.append({
                    "chunk_id": chunk.qdrant_point_id,
                    "content": tc.content,
                    "content_hash": tc.content_hash,
                    "document_title": page.title,
                    "url": page.url,
                    "provenance": SourceProvenance.TENANT_AUTHORITATIVE.value,
                })

            if embeddings_data:
                texts = [e["content"] for e in embeddings_data]
                vectors = await embedding_service.embed_texts(texts)
                for i, vec in enumerate(vectors):
                    embeddings_data[i]["embedding"] = vec

                await vector_store.upsert_chunks(tenant_id, product_id, embeddings_data)
                total_chunks += len(embeddings_data)

        source.pages_processed = len(pages)
        source.status = SourceStatus.COMPLETED
        source.content_hash = combined_hash.hexdigest()
        source.last_crawled_at = datetime.now(timezone.utc)
        await record_usage(db, tenant_id, pages=len(pages))

        return {
            "pages_processed": len(pages),
            "chunks_created": total_chunks,
            "status": "completed",
        }

    except Exception as exc:
        source.status = SourceStatus.FAILED
        source.error_message = str(exc)[:500]
        return {"status": "failed", "error": str(exc)}


async def _clear_source_documents(
    db: AsyncSession,
    source: Source,
    tenant_id: uuid.UUID,
) -> None:
    docs_result = await db.execute(
        select(Document).where(Document.source_id == source.id)
    )
    documents = docs_result.scalars().all()
    point_ids: list[str] = []

    for doc in documents:
        chunks_result = await db.execute(
            select(Chunk).where(Chunk.document_id == doc.id)
        )
        for chunk in chunks_result.scalars().all():
            point_ids.append(chunk.qdrant_point_id)

    if point_ids:
        await vector_store.delete_points(point_ids)

    if documents:
        doc_ids = [d.id for d in documents]
        await db.execute(delete(Chunk).where(Chunk.document_id.in_(doc_ids)))
        await db.execute(delete(Document).where(Document.id.in_(doc_ids)))


async def ingest_all_sources(
    db: AsyncSession,
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
    source_ids: Optional[list[uuid.UUID]] = None,
    *,
    force: bool = False,
) -> dict:
    query = select(Source).where(
        Source.product_id == product_id,
        Source.tenant_id == tenant_id,
    )
    if source_ids:
        query = query.where(Source.id.in_(source_ids))

    result = await db.execute(query)
    sources = result.scalars().all()

    results = []
    for source in sources:
        if force or source.status != SourceStatus.COMPLETED:
            r = await ingest_source(db, source, tenant_id, product_id, force=force)
            results.append({"source_id": str(source.id), **r})

    return {"sources_processed": len(results), "results": results}
