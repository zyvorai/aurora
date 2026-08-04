"""Qdrant vector store with tenant isolation."""

import uuid
from dataclasses import dataclass
from typing import Optional

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from gtm_api.config import get_settings

settings = get_settings()


@dataclass
class SearchResult:
    chunk_id: str
    content: str
    score: float
    document_title: str
    url: Optional[str]
    metadata: dict


class VectorStore:
    def __init__(self) -> None:
        self.client = AsyncQdrantClient(
            url=settings.qdrant_url,
            check_compatibility=False,
        )

    @property
    def collection(self) -> str:
        return get_settings().qdrant_collection_resolved

    async def ensure_collection(self) -> None:
        current_settings = get_settings()
        collections = await self.client.get_collections()
        names = [c.name for c in collections.collections]
        if self.collection not in names:
            await self.client.create_collection(
                collection_name=self.collection,
                vectors_config=VectorParams(
                    size=current_settings.embedding_dimensions,
                    distance=Distance.COSINE,
                ),
            )

    async def upsert_chunks(
        self,
        tenant_id: uuid.UUID,
        product_id: uuid.UUID,
        chunks: list[dict],
    ) -> None:
        await self.ensure_collection()
        points = []
        for chunk in chunks:
            point_id = str(chunk["chunk_id"])
            points.append(
                PointStruct(
                    id=point_id,
                    vector=chunk["embedding"],
                    payload={
                        "tenant_id": str(tenant_id),
                        "product_id": str(product_id),
                        "chunk_id": point_id,
                        "content": chunk["content"],
                        "document_title": chunk.get("document_title", ""),
                        "url": chunk.get("url"),
                        "content_hash": chunk.get("content_hash", ""),
                        "provenance": chunk.get("provenance", "tenant_authoritative"),
                    },
                )
            )
        if points:
            await self.client.upsert(collection_name=self.collection, points=points)

    async def search(
        self,
        tenant_id: uuid.UUID,
        product_id: uuid.UUID,
        query_vector: list[float],
        limit: int = 5,
        provenance_filter: Optional[str] = "tenant_authoritative",
    ) -> list[SearchResult]:
        await self.ensure_collection()
        must_conditions = [
            FieldCondition(key="tenant_id", match=MatchValue(value=str(tenant_id))),
            FieldCondition(key="product_id", match=MatchValue(value=str(product_id))),
        ]
        if provenance_filter:
            must_conditions.append(
                FieldCondition(key="provenance", match=MatchValue(value=provenance_filter))
            )

        response = await self.client.query_points(
            collection_name=self.collection,
            query=query_vector,
            query_filter=Filter(must=must_conditions),
            limit=limit,
        )

        return [
            SearchResult(
                chunk_id=r.payload.get("chunk_id", str(r.id)),
                content=r.payload.get("content", ""),
                score=r.score,
                document_title=r.payload.get("document_title", ""),
                url=r.payload.get("url"),
                metadata={k: v for k, v in r.payload.items() if k not in ("content",)},
            )
            for r in response.points
        ]

    async def delete_points(self, point_ids: list[str]) -> None:
        if not point_ids:
            return
        from qdrant_client.models import PointIdsList

        await self.client.delete(
            collection_name=self.collection,
            points_selector=PointIdsList(points=point_ids),
        )

    async def delete_product_chunks(
        self, tenant_id: uuid.UUID, product_id: uuid.UUID
    ) -> None:
        await self.client.delete(
            collection_name=self.collection,
            points_selector=Filter(
                must=[
                    FieldCondition(key="tenant_id", match=MatchValue(value=str(tenant_id))),
                    FieldCondition(key="product_id", match=MatchValue(value=str(product_id))),
                ]
            ),
        )


vector_store = VectorStore()
