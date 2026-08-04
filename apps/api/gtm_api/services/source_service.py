"""Source CRUD helpers — create, upload, delete."""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import Chunk, Document, Source, SourceCredential, SourceType
from gtm_api.services.credentials import encrypt_secret
from gtm_api.services.loaders.database import DatabaseLoader
from gtm_api.services.storage import storage_service
from gtm_api.services.vector_store import vector_store


VALID_SOURCE_TYPES = {t.value for t in SourceType}


def validate_source_type(source_type: str) -> SourceType:
    if source_type not in VALID_SOURCE_TYPES:
        raise ValueError(f"Invalid source_type: {source_type}")
    return SourceType(source_type)


async def delete_source(
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

    if source.storage_key:
        storage_service.delete_object(source.storage_key)

    await db.execute(delete(Source).where(Source.id == source.id))
    await db.flush()


async def store_upload(
    db: AsyncSession,
    source: Source,
    filename: str,
    data: bytes,
    content_type: str,
) -> None:
    key = storage_service.put_object(
        source.tenant_id,
        source.product_id,
        source.id,
        filename,
        data,
        content_type,
    )
    source.storage_key = key
    source.mime_type = content_type
    source.file_size_bytes = len(data)
    if not source.display_name:
        source.display_name = filename
    await db.flush()


async def create_credential(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    channel: str,
    secrets: dict,
) -> SourceCredential:
    cred = SourceCredential(
        tenant_id=tenant_id,
        channel=channel,
        encrypted_token=encrypt_secret(secrets),
    )
    db.add(cred)
    await db.flush()
    return cred


async def test_database_connection(secrets: dict) -> list[str]:
    import asyncio
    return await asyncio.to_thread(DatabaseLoader.test_connection, secrets)
