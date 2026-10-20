"""Unit tests for artifact source-version provenance and stale detection."""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from gtm_api.models import ApprovalStatus, Artifact, ArtifactDependency, ArtifactType, Document
from gtm_api.services.artifact_provenance import (
    STALE_SOURCE_CHANGED,
    STALE_UNVERIFIED,
    acknowledge_current_sources,
    mark_stale_artifacts,
    record_dependencies,
)

NOW = datetime(2026, 10, 20, tzinfo=UTC)
TENANT, PRODUCT = uuid.uuid4(), uuid.uuid4()


def _result(items):
    r = MagicMock()
    r.scalars.return_value.all.return_value = items
    r.scalars.return_value.first.return_value = items[0] if items else None
    return r


def _db(*results):
    db = AsyncMock()
    db.add = MagicMock()
    db.execute = AsyncMock(side_effect=[_result(x) for x in results])
    return db


def _artifact(status=ApprovalStatus.APPROVED, type_=ArtifactType.PROPOSAL, created=None, citations=None):
    return Artifact(
        id=uuid.uuid4(),
        tenant_id=TENANT,
        product_id=PRODUCT,
        artifact_type=type_,
        status=status,
        created_at=created or NOW - timedelta(days=2),
        citations=citations or [],
        stale_reason=None,
    )


def _dep(artifact, url="https://x/docs", hash_="old"):
    return ArtifactDependency(
        artifact_id=artifact.id, tenant_id=TENANT, document_id=uuid.uuid4(),
        document_url=url, document_title="Docs", content_hash_at_use=hash_,
    )


def _doc(hash_, url="https://x/docs"):
    return Document(id=uuid.uuid4(), product_id=PRODUCT, tenant_id=TENANT, url=url,
                    title="Docs", content_hash=hash_)


@pytest.mark.asyncio
async def test_changed_document_flags_dependent_artifact():
    a = _artifact()
    db = _db([a], [_dep(a)], [_doc("new")])
    out = await mark_stale_artifacts(db, PRODUCT, TENANT, NOW - timedelta(minutes=1), NOW)
    assert out == {"stale": 1, "unverified": 0}
    assert a.stale_reason == STALE_SOURCE_CHANGED and a.stale_since == NOW


@pytest.mark.asyncio
async def test_unchanged_document_leaves_artifact_alone():
    a = _artifact()
    db = _db([a], [_dep(a)], [_doc("old")])
    out = await mark_stale_artifacts(db, PRODUCT, TENANT, NOW, NOW)
    assert out == {"stale": 0, "unverified": 0}
    assert a.stale_reason is None


@pytest.mark.asyncio
async def test_removed_document_flags_artifact():
    a = _artifact()
    db = _db([a], [_dep(a)], [])
    out = await mark_stale_artifacts(db, PRODUCT, TENANT, NOW, NOW)
    assert out["stale"] == 1


@pytest.mark.asyncio
async def test_no_provenance_approved_proposal_flagged_unverified():
    a = _artifact()
    db = _db([a], [])
    out = await mark_stale_artifacts(db, PRODUCT, TENANT, NOW, NOW)
    assert out == {"stale": 0, "unverified": 1}
    assert a.stale_reason == STALE_UNVERIFIED


@pytest.mark.asyncio
async def test_no_provenance_drafts_and_new_artifacts_not_flagged():
    draft = _artifact(status=ApprovalStatus.DRAFT)
    newer = _artifact(created=NOW + timedelta(minutes=5))
    strategy = _artifact(type_=ArtifactType.STRATEGY)
    db = _db([draft, newer, strategy], [], [], [])
    out = await mark_stale_artifacts(db, PRODUCT, TENANT, NOW, NOW)
    assert out == {"stale": 0, "unverified": 0}


@pytest.mark.asyncio
async def test_record_dependencies_from_citations():
    a = _artifact(citations=[{"chunk_id": "p1"}, {"chunk_id": "p2"}])
    doc = _doc("h1")
    db = _db([doc])
    assert await record_dependencies(db, a) == 1
    dep = db.add.call_args.args[0]
    assert dep.content_hash_at_use == "h1" and dep.artifact_id == a.id


@pytest.mark.asyncio
async def test_record_dependencies_without_citations_is_noop():
    db = _db()
    assert await record_dependencies(db, _artifact()) == 0
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_acknowledge_repins_dependencies_and_clears_flag():
    a = _artifact()
    a.stale_reason, a.stale_since = STALE_SOURCE_CHANGED, NOW
    dep = _dep(a)
    db = _db([dep], [_doc("new")])
    await acknowledge_current_sources(db, a)
    assert dep.content_hash_at_use == "new"
    assert a.stale_reason is None and a.stale_since is None


@pytest.mark.asyncio
async def test_refresh_product_reports_real_stale_count():
    from unittest.mock import patch

    from gtm_api.models import Source
    from gtm_api.services.learning import refresh_product

    source = Source(id=uuid.uuid4(), product_id=PRODUCT, tenant_id=TENANT, url="https://x")
    db = _db([source])
    with (
        patch("gtm_api.services.learning.check_source_changes", AsyncMock(return_value=True)),
        patch("gtm_api.services.learning.ingest_source", AsyncMock(return_value={"status": "completed"})),
        patch(
            "gtm_api.services.learning.mark_stale_artifacts",
            AsyncMock(return_value={"stale": 2, "unverified": 1}),
        ),
    ):
        out = await refresh_product(db, PRODUCT, TENANT)
    assert out["stale_artifacts_flagged"] == 3
    assert out["stale_artifacts"] == {"stale": 2, "unverified": 1}


@pytest.mark.asyncio
async def test_refresh_product_without_changes_flags_nothing():
    from unittest.mock import patch

    from gtm_api.models import Source
    from gtm_api.services.learning import refresh_product

    source = Source(id=uuid.uuid4(), product_id=PRODUCT, tenant_id=TENANT, url="https://x")
    db = _db([source])
    with (
        patch("gtm_api.services.learning.check_source_changes", AsyncMock(return_value=False)),
        patch("gtm_api.services.learning.mark_stale_artifacts", AsyncMock()) as mark,
    ):
        out = await refresh_product(db, PRODUCT, TENANT)
    mark.assert_not_called()
    assert out["stale_artifacts_flagged"] == 0
