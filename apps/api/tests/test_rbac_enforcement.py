"""RBAC enforcement through the real FastAPI dependency graph.

test_auth_rbac.py unit-tests the require_permission() checker in isolation. That doesn't
prove a route actually wires the checker in as a Depends() — nor does this suite's usual
convention of calling router functions directly with keyword args, which bypasses Depends()
resolution entirely. These tests go through TestClient + dependency_overrides so a route
whose permission dependency is missing or wrong would actually fail here.
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from gtm_api.auth import get_current_user
from gtm_api.database import get_db
from gtm_api.main import app
from gtm_api.models import PlanTier, Tenant, User


def _user(role: str) -> User:
    return User(
        id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        email=f"{role}@acme.com",
        hashed_password="x",
        role=role,
        is_active=True,
    )


def _override_current_user(user: User):
    async def _get_current_user():
        return user

    return _get_current_user


def _override_db(mock_db):
    async def _get_db():
        yield mock_db

    return _get_db


class TestRBACEnforcementViaRoutes:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_viewer_blocked_from_manage_tenant_route(self):
        app.dependency_overrides[get_current_user] = _override_current_user(_user("viewer"))
        app.dependency_overrides[get_db] = _override_db(AsyncMock())

        with TestClient(app) as client:
            response = client.post("/api/v1/admin/purge", json={"confirm": "acme"})

        assert response.status_code == 403

    def test_editor_blocked_from_manage_tenant_route(self):
        app.dependency_overrides[get_current_user] = _override_current_user(_user("editor"))
        app.dependency_overrides[get_db] = _override_db(AsyncMock())

        with TestClient(app) as client:
            response = client.get("/api/v1/admin/export")

        assert response.status_code == 403

    def test_editor_allowed_on_write_permission_route(self):
        tenant_id = uuid.uuid4()
        tenant = Tenant(id=tenant_id, name="Acme", slug="acme", plan=PlanTier.GROWTH, is_active=True)
        user = _user("editor")
        user.tenant_id = tenant_id

        def _populate_generated_fields(entry):
            entry.id = uuid.uuid4()
            entry.created_at = datetime.now(timezone.utc)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: tenant))
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock(side_effect=_populate_generated_fields)

        app.dependency_overrides[get_current_user] = _override_current_user(user)
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                "/api/v1/admin/suppression", json={"email": "x@example.com"}
            )

        # editor has "write" -> must not be blocked by RBAC (403 would mean the route's
        # permission dependency is wrong)
        assert response.status_code == 201

    def test_viewer_allowed_on_read_permission_route(self):
        tenant_id = uuid.uuid4()
        tenant = Tenant(id=tenant_id, name="Acme", slug="acme", plan=PlanTier.GROWTH, is_active=True)
        user = _user("viewer")
        user.tenant_id = tenant_id

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: tenant),  # get_tenant_context
                MagicMock(scalars=lambda: MagicMock(all=lambda: [])),  # count_active_products
            ]
        )
        mock_db.get = AsyncMock(return_value=tenant)

        app.dependency_overrides[get_current_user] = _override_current_user(user)
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.get("/api/v1/admin/plan")

        assert response.status_code == 200
        assert response.json()["plan"] == "growth"

    def test_admin_allowed_on_manage_tenant_route(self):
        tenant_id = uuid.uuid4()
        tenant = Tenant(id=tenant_id, name="Acme", slug="acme", plan=PlanTier.GROWTH, is_active=True)
        user = _user("admin")
        user.tenant_id = tenant_id

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: tenant),  # get_tenant_context
                MagicMock(scalars=lambda: MagicMock(all=lambda: [])),  # purge_tenant_data lookup
            ]
        )
        mock_db.get = AsyncMock(return_value=tenant)
        mock_db.add = MagicMock()

        app.dependency_overrides[get_current_user] = _override_current_user(user)
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post("/api/v1/admin/purge", json={"confirm": "acme"})

        assert response.status_code == 200
        assert response.json()["status"] == "purged"
