"""Ingest pipeline test (docs/gtm-platform-phases.md's test_ingest_pipeline)."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from gtm_api.models import Source, SourceStatus, SourceType
from gtm_api.services.crawler import CrawledPage
from gtm_api.services.ingestion import ingest_source


@pytest.mark.asyncio
async def test_ingest_pipeline():
    tenant_id = uuid.uuid4()
    product_id = uuid.uuid4()
    source = Source(
        id=uuid.uuid4(),
        product_id=product_id,
        tenant_id=tenant_id,
        source_type=SourceType.WEBSITE,
        url="https://example.com",
        status=SourceStatus.PENDING,
    )

    page = CrawledPage(
        url="https://example.com",
        title="Example",
        content="Example product overview content.",
        content_hash="abc123",
        links=[],
    )

    mock_db = AsyncMock()
    # First execute() call: "existing document" lookup -> none found.
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=lambda: None)
    )
    mock_db.flush = AsyncMock()
    mock_db.add = MagicMock()

    with patch(
        "gtm_api.services.ingestion.load_source_pages", AsyncMock(return_value=[page])
    ), patch(
        "gtm_api.services.ingestion.embedding_service.embed_texts",
        AsyncMock(return_value=[[0.1, 0.2, 0.3]]),
    ), patch(
        "gtm_api.services.ingestion.vector_store.upsert_chunks", AsyncMock()
    ) as mock_upsert, patch(
        "gtm_api.services.ingestion.record_usage", AsyncMock()
    ):
        result = await ingest_source(mock_db, source, tenant_id, product_id)

    assert result["status"] == "completed"
    assert result["pages_processed"] == 1
    assert result["chunks_created"] == 1
    assert source.status == SourceStatus.COMPLETED
    mock_upsert.assert_awaited_once()
