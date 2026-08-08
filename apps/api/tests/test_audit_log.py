"""Audit trail: log creation on a real write action, and readback via GET /audit."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from gtm_api.auth import get_current_user
from gtm_api.database import get_db
from gtm_api.main import app
from gtm_api.models import AuditLog, PlanTier, Tenant, User
from gtm_api.services.enterprise import get_audit_trail
from gtm_api.tenant import audit_log


def _override_current_user(user: User):
    async def _get_current_user():
        return user

    return _get_current_user


def _override_db(mock_db):
    async def _get_db():
        yield mock_db

    return _get_db


class TestAuditLogHelper:
    @pytest.mark.asyncio
    async def test_audit_log_adds_row_with_expected_fields(self):
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        tenant_id = uuid.uuid4()
        user_id = uuid.uuid4()

        await audit_log(
            mock_db, tenant_id, user_id, "purge", "tenant",
            resource_id=str(tenant_id), details={"reason": "test"},
        )

        mock_db.add.assert_called_once()
        row = mock_db.add.call_args[0][0]
        assert isinstance(row, AuditLog)
        assert row.tenant_id == tenant_id
        assert row.user_id == user_id
        assert row.action == "purge"
        assert row.resource_type == "tenant"
        assert row.resource_id == str(tenant_id)
        assert row.details == {"reason": "test"}

    @pytest.mark.asyncio
    async def test_get_audit_trail_scoped_to_tenant(self):
        tenant_id = uuid.uuid4()
        rows = [MagicMock(), MagicMock()]
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: rows)))

        result = await get_audit_trail(mock_db, tenant_id)

        assert result == rows


class TestAuditLogWiredToRoute:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_admin_suppression_write_creates_audit_log(self):
        """Hitting the real POST /admin/suppression route must audit-log the action, not
        just build a SuppressionEntry — proves the call site is wired, not just the helper."""
        tenant_id = uuid.uuid4()
        tenant = Tenant(id=tenant_id, name="Acme", slug="acme", plan=PlanTier.GROWTH, is_active=True)
        user = User(
            id=uuid.uuid4(), tenant_id=tenant_id, email="e@acme.com",
            hashed_password="x", role="editor", is_active=True,
        )

        def _populate_generated_fields(entry):
            import datetime as dt
            entry.id = uuid.uuid4()
            entry.created_at = dt.datetime.now(dt.timezone.utc)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: tenant))
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock(side_effect=_populate_generated_fields)

        app.dependency_overrides[get_current_user] = _override_current_user(user)
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                "/api/v1/admin/suppression", json={"email": "blocked@example.com"}
            )

        assert response.status_code == 201
        added_types = [type(call.args[0]) for call in mock_db.add.call_args_list]
        assert AuditLog in added_types
        audit_row = next(c.args[0] for c in mock_db.add.call_args_list if isinstance(c.args[0], AuditLog))
        assert audit_row.action == "suppress"
        assert audit_row.tenant_id == tenant_id
        assert audit_row.details == {"email": "blocked@example.com"}
