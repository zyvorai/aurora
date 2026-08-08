"""Tenant isolation test against a real (in-memory) Qdrant client.

docs/gtm-platform-phases.md's test_tenant_isolation_qdrant: exercises the
actual FieldCondition tenant_id filter in VectorStore.search() rather than
mocking it away. Uses qdrant-client's in-memory mode so this stays offline
(no server needed) and fast enough for `make test`.
"""

import uuid

import pytest
from qdrant_client import AsyncQdrantClient

from gtm_api.config import get_settings
from gtm_api.services.vector_store import VectorStore


def _one_hot_vector(index: int) -> list[float]:
    dims = get_settings().embedding_dimensions
    vector = [0.0] * dims
    vector[index] = 1.0
    return vector


@pytest.mark.asyncio
async def test_tenant_isolation_qdrant():
    store = VectorStore()
    store.client = AsyncQdrantClient(location=":memory:")

    product_id = uuid.uuid4()
    tenant_a = uuid.uuid4()
    tenant_b = uuid.uuid4()
    vector_a = _one_hot_vector(0)
    vector_b = _one_hot_vector(1)
    # qdrant-client's local backend requires point ids to be valid UUIDs.
    chunk_a_id = str(uuid.uuid4())
    chunk_b_id = str(uuid.uuid4())

    await store.upsert_chunks(
        tenant_a,
        product_id,
        [
            {
                "chunk_id": chunk_a_id,
                "content": "Tenant A confidential content",
                "embedding": vector_a,
                "document_title": "Doc A",
                "url": "https://a.example.com",
                "content_hash": "hash-a",
            }
        ],
    )
    await store.upsert_chunks(
        tenant_b,
        product_id,
        [
            {
                "chunk_id": chunk_b_id,
                "content": "Tenant B confidential content",
                "embedding": vector_b,
                "document_title": "Doc B",
                "url": "https://b.example.com",
                "content_hash": "hash-b",
            }
        ],
    )

    results_a = await store.search(tenant_a, product_id, vector_a, limit=10)
    assert [r.chunk_id for r in results_a] == [chunk_a_id]

    results_b = await store.search(tenant_b, product_id, vector_b, limit=10)
    assert [r.chunk_id for r in results_b] == [chunk_b_id]

    # Even when tenant B queries with tenant A's own vector, the tenant_id
    # filter must scope results to tenant B's data -- tenant A's chunk must
    # never appear, regardless of vector similarity.
    cross_tenant = await store.search(tenant_b, product_id, vector_a, limit=10)
    assert chunk_a_id not in [r.chunk_id for r in cross_tenant]
