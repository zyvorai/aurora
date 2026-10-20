"""HTTP-level check of the review gate: a stale artifact can't be published until it is
re-approved, and approval clears the flag. Mocked DB, real routes and permissions."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from gtm_api.auth import get_current_user
from gtm_api.database import get_db
from gtm_api.main import app
from gtm_api.models import ApprovalStatus, Artifact, ArtifactType, PlanTier, Tenant, User

TENANT_ID = uuid.uuid4()


def _artifact():
    return Artifact(
        id=uuid.uuid4(), tenant_id=TENANT_ID, product_id=uuid.uuid4(),
        artifact_type=ArtifactType.PROPOSAL, title="Proposal", content="c", content_hash="h",
        version=1, status=ApprovalStatus.APPROVED, stale_reason="source_changed",
        stale_since=datetime.now(UTC),
    )


@pytest.fixture
def client_and_artifact():
    artifact = _artifact()
    tenant = Tenant(id=TENANT_ID, name="Acme", slug="acme", plan=PlanTier.GROWTH, is_active=True)
    user = User(id=uuid.uuid4(), tenant_id=TENANT_ID, email="a@acme.com", hashed_password="x",
                role="admin", is_active=True)

    def result(value=None, rows=()):
        r = MagicMock()
        r.scalar_one_or_none.return_value = value
        r.scalars.return_value.all.return_value = list(rows)
        return r

    async def execute(stmt):
        sql = str(stmt)
        if "FROM tenants" in sql:
            return result(tenant)
        if "FROM artifact_dependencies" in sql:
            return result(rows=[])
        return result(artifact)

    db = AsyncMock()
    db.execute = execute
    db.add = MagicMock()

    async def refresh(obj):  # what the real DB assigns on insert
        obj.id = obj.id or uuid.uuid4()
        obj.created_at = obj.created_at or datetime.now(UTC)

    db.refresh = refresh

    async def _get_db():
        yield db

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = lambda: user
    yield TestClient(app), artifact
    app.dependency_overrides.clear()


def test_stale_artifact_cannot_be_published_until_reapproved(client_and_artifact):
    client, artifact = client_and_artifact
    publish = f"/api/v1/artifacts/{artifact.id}/publish"
    body = {"artifact_id": str(artifact.id), "channel": "email", "recipient": "buyer@example.com"}

    blocked = client.post(publish, json=body)
    assert blocked.status_code == 409
    assert "re-review" in blocked.json()["detail"]

    approved = client.post(f"/api/v1/artifacts/{artifact.id}/approve", json={"status": "approved"})
    assert approved.status_code == 200, approved.text
    assert artifact.stale_reason is None and artifact.stale_since is None

    post = SimpleNamespace(id=uuid.uuid4(), status="sent", idempotency_key="k")
    with patch("gtm_api.routers.marketing.publish_artifact", AsyncMock(return_value=post)):
        ok = client.post(publish, json=body)
    assert ok.status_code == 200, ok.text
    assert ok.json()["status"] == "sent"


def test_rejecting_does_not_clear_the_stale_flag(client_and_artifact):
    client, artifact = client_and_artifact
    r = client.post(f"/api/v1/artifacts/{artifact.id}/approve", json={"status": "rejected"})
    assert r.status_code == 200, r.text
    assert artifact.stale_reason == "source_changed"
