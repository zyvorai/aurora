"""Minimal tool registry for agent-callable actions.

Scope is intentionally limited to the three tools named in
docs/multi-agent-composition-plan.md section 3.2 (search_kb, create_artifact,
schedule_post) -- this is not a general plugin framework.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Awaitable, Callable, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import content_hash
from gtm_api.models import ApprovalStatus, Artifact, ArtifactType, ChannelPost
from gtm_api.services.embeddings import embedding_service
from gtm_api.services.vector_store import vector_store


async def search_kb(
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
    query: str,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Search the tenant's grounded knowledge base for a product."""
    if not query:
        return []
    query_vector = await embedding_service.embed_query(query)
    results = await vector_store.search(tenant_id, product_id, query_vector, limit=limit)
    return [
        {
            "chunk_id": r.chunk_id,
            "content": r.content,
            "url": r.url,
            "document_title": r.document_title,
            "score": r.score,
        }
        for r in results
    ]


async def create_artifact(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
    user_id: uuid.UUID,
    artifact_type: str,
    title: str,
    content: str,
    metadata: Optional[dict] = None,
) -> Artifact:
    """Persist a draft artifact. Callable by any agent handler that needs to
    hand off structured output without duplicating this persistence logic."""
    artifact = Artifact(
        product_id=product_id,
        tenant_id=tenant_id,
        artifact_type=ArtifactType(artifact_type),
        title=title,
        content=content,
        content_hash=content_hash(content),
        status=ApprovalStatus.DRAFT,
        metadata_=metadata or {},
        created_by=user_id,
    )
    db.add(artifact)
    await db.flush()
    await db.refresh(artifact)
    return artifact


async def schedule_post(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    artifact_id: uuid.UUID,
    channel: str,
    scheduled_at: Optional[datetime] = None,
) -> ChannelPost:
    """Schedule (or immediately publish) an approved artifact on a channel."""
    from gtm_api.services.publishing import publish_artifact

    artifact = await db.get(Artifact, artifact_id)
    if not artifact or artifact.tenant_id != tenant_id:
        raise ValueError("Artifact not found")
    return await publish_artifact(db, artifact, tenant_id, user_id, channel, scheduled_at)


TOOL_REGISTRY: dict[str, Callable[..., Awaitable[Any]]] = {
    "search_kb": search_kb,
    "create_artifact": create_artifact,
    "schedule_post": schedule_post,
}
