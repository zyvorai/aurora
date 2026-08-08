"""Publish approval-gate test (docs/gtm-platform-phases.md's test_approval_blocks_publish)."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from gtm_api.models import Approval, ApprovalStatus, Artifact, ArtifactType
from gtm_api.services.publishing import publish_artifact


def _make_artifact(tenant_id, content_hash="hash-1"):
    return Artifact(
        id=uuid.uuid4(),
        product_id=uuid.uuid4(),
        tenant_id=tenant_id,
        artifact_type=ArtifactType.CONTENT,
        title="Draft post",
        content="Hello world",
        content_hash=content_hash,
        status=ApprovalStatus.DRAFT,
    )


@pytest.mark.asyncio
async def test_publish_blocked_without_approval():
    tenant_id = uuid.uuid4()
    artifact = _make_artifact(tenant_id)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))

    with pytest.raises(ValueError, match="must be approved"):
        await publish_artifact(mock_db, artifact, tenant_id, uuid.uuid4(), "blog")


@pytest.mark.asyncio
async def test_publish_succeeds_with_approval():
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    artifact = _make_artifact(tenant_id)
    approval = Approval(
        id=uuid.uuid4(),
        artifact_id=artifact.id,
        tenant_id=tenant_id,
        artifact_version=artifact.version,
        content_hash=artifact.content_hash,
        status=ApprovalStatus.APPROVED,
        reviewer_id=user_id,
    )

    mock_db = AsyncMock()
    # 1st execute(): approval lookup -> found. 2nd execute(): idempotency dedupe check -> none found.
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: approval),
            MagicMock(scalar_one_or_none=lambda: None),
        ]
    )
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()

    post = await publish_artifact(mock_db, artifact, tenant_id, user_id, "blog")

    assert post.idempotency_key == f"{artifact.id}:blog:{artifact.content_hash[:16]}"
    assert post.status == "not_configured"  # blog is a stub adapter until real credentials are wired up


@pytest.mark.asyncio
async def test_publish_rejects_duplicate_idempotency_key():
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    artifact = _make_artifact(tenant_id)
    approval = Approval(
        id=uuid.uuid4(),
        artifact_id=artifact.id,
        tenant_id=tenant_id,
        artifact_version=artifact.version,
        content_hash=artifact.content_hash,
        status=ApprovalStatus.APPROVED,
        reviewer_id=user_id,
    )
    existing_post = MagicMock()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: approval),
            MagicMock(scalar_one_or_none=lambda: existing_post),
        ]
    )

    with pytest.raises(ValueError, match="Already published"):
        await publish_artifact(mock_db, artifact, tenant_id, user_id, "blog")


@pytest.mark.asyncio
async def test_publish_email_channel_real_adapter_not_configured_without_smtp():
    """email/newsletter route through the real SMTP adapter; without SMTP env
    vars set it must degrade to not_configured rather than pretending to send."""
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    artifact = _make_artifact(tenant_id)
    approval = Approval(
        id=uuid.uuid4(),
        artifact_id=artifact.id,
        tenant_id=tenant_id,
        artifact_version=artifact.version,
        content_hash=artifact.content_hash,
        status=ApprovalStatus.APPROVED,
        reviewer_id=user_id,
    )

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: approval),
            MagicMock(scalar_one_or_none=lambda: None),
        ]
    )
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()

    post = await publish_artifact(mock_db, artifact, tenant_id, user_id, "email")

    assert post.status == "not_configured"
    assert post.error_message
