"""Public API-key authentication: generation, hashing, request-time resolution, and
the /auth/api-keys management routes."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from gtm_api.auth import (
    API_KEY_PREFIX,
    _resolve_api_key,
    generate_api_key,
    get_current_user,
    hash_api_key,
)
from gtm_api.database import get_db
from gtm_api.main import app
from gtm_api.models import ApiKey, User


class TestGenerateApiKey:
    def test_generates_prefixed_key_and_matching_hash(self):
        raw_key, key_prefix, key_hash = generate_api_key()
        assert raw_key.startswith(API_KEY_PREFIX)
        assert raw_key.startswith(key_prefix)
        assert key_hash == hash_api_key(raw_key)

    def test_generates_unique_keys(self):
        keys = {generate_api_key()[0] for _ in range(20)}
        assert len(keys) == 20


class TestResolveApiKey:
    @pytest.mark.asyncio
    async def test_valid_key_resolves_to_user_with_key_role(self):
        tenant_id = uuid.uuid4()
        key_id = uuid.uuid4()
        raw_key, _, key_hash = generate_api_key()
        stored = ApiKey(
            id=key_id, tenant_id=tenant_id, name="ci-bot", key_prefix="sk_live_",
            key_hash=key_hash, role="editor", revoked_at=None,
        )
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: stored))

        user = await _resolve_api_key(raw_key, mock_db)

        assert isinstance(user, User)
        assert user.id == key_id
        assert user.tenant_id == tenant_id
        assert user.role == "editor"
        assert user.is_active is True

    @pytest.mark.asyncio
    async def test_unknown_key_rejected(self):
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))

        with pytest.raises(HTTPException) as exc_info:
            await _resolve_api_key("sk_live_doesnotexist", mock_db)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_revoked_key_rejected(self):
        raw_key, _, key_hash = generate_api_key()
        stored = ApiKey(
            id=uuid.uuid4(), tenant_id=uuid.uuid4(), name="old-bot", key_prefix="sk_live_",
            key_hash=key_hash, role="admin", revoked_at=datetime.now(timezone.utc),
        )
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: stored))

        with pytest.raises(HTTPException) as exc_info:
            await _resolve_api_key(raw_key, mock_db)
        assert exc_info.value.status_code == 401


class TestGetCurrentUserAcceptsApiKey:
    """Proves X-API-Key is a real alternative auth path on the actual dependency used by
    every protected route, not just a standalone helper function."""

    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_request_with_valid_api_key_header_authenticates(self):
        tenant_id = uuid.uuid4()
        raw_key, _, key_hash = generate_api_key()
        stored = ApiKey(
            id=uuid.uuid4(), tenant_id=tenant_id, name="ci-bot", key_prefix="sk_live_",
            key_hash=key_hash, role="viewer", revoked_at=None,
        )
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: stored))

        async def _get_db():
            yield mock_db

        app.dependency_overrides[get_db] = _get_db

        with TestClient(app) as client:
            response = client.get("/api/v1/auth/me", headers={"X-API-Key": raw_key})

        assert response.status_code == 200
        assert response.json()["role"] == "viewer"

    def test_request_with_no_credentials_rejected(self):
        with TestClient(app) as client:
            response = client.get("/api/v1/auth/me")
        assert response.status_code == 403

    def test_request_with_bogus_api_key_rejected(self):
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))

        async def _get_db():
            yield mock_db

        app.dependency_overrides[get_db] = _get_db

        with TestClient(app) as client:
            response = client.get("/api/v1/auth/me", headers={"X-API-Key": "sk_live_bogus"})
        assert response.status_code == 401


class TestApiKeyManagementRoutes:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def _admin(self, tenant_id):
        return User(
            id=uuid.uuid4(), tenant_id=tenant_id, email="admin@acme.com",
            hashed_password="x", role="admin", is_active=True,
        )

    def _viewer(self, tenant_id):
        return User(
            id=uuid.uuid4(), tenant_id=tenant_id, email="viewer@acme.com",
            hashed_password="x", role="viewer", is_active=True,
        )

    def test_viewer_cannot_create_api_keys(self):
        from gtm_api.auth import get_current_user as gcu
        from gtm_api.models import Tenant, PlanTier

        tenant_id = uuid.uuid4()
        tenant = Tenant(id=tenant_id, name="Acme", slug="acme", plan=PlanTier.GROWTH, is_active=True)

        async def _override_user():
            return self._viewer(tenant_id)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: tenant))

        async def _get_db():
            yield mock_db

        app.dependency_overrides[gcu] = _override_user
        app.dependency_overrides[get_db] = _get_db

        with TestClient(app) as client:
            response = client.post("/api/v1/auth/api-keys", json={"name": "bot", "role": "viewer"})
        assert response.status_code == 403

    def test_admin_creates_and_receives_raw_key_once(self):
        from gtm_api.auth import get_current_user as gcu
        from gtm_api.models import Tenant, PlanTier

        tenant_id = uuid.uuid4()
        tenant = Tenant(id=tenant_id, name="Acme", slug="acme", plan=PlanTier.GROWTH, is_active=True)
        admin = self._admin(tenant_id)

        def _populate(entry):
            entry.id = uuid.uuid4()
            entry.created_at = datetime.now(timezone.utc)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: tenant))
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock(side_effect=_populate)

        async def _override_user():
            return admin

        async def _get_db():
            yield mock_db

        app.dependency_overrides[gcu] = _override_user
        app.dependency_overrides[get_db] = _get_db

        with TestClient(app) as client:
            response = client.post("/api/v1/auth/api-keys", json={"name": "ci-bot", "role": "editor"})

        assert response.status_code == 201
        body = response.json()
        assert body["api_key"].startswith(API_KEY_PREFIX)
        assert body["role"] == "editor"

    def test_create_rejects_unknown_role(self):
        from gtm_api.auth import get_current_user as gcu
        from gtm_api.models import Tenant, PlanTier

        tenant_id = uuid.uuid4()
        tenant = Tenant(id=tenant_id, name="Acme", slug="acme", plan=PlanTier.GROWTH, is_active=True)
        admin = self._admin(tenant_id)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: tenant))

        async def _override_user():
            return admin

        async def _get_db():
            yield mock_db

        app.dependency_overrides[gcu] = _override_user
        app.dependency_overrides[get_db] = _get_db

        with TestClient(app) as client:
            response = client.post("/api/v1/auth/api-keys", json={"name": "bot", "role": "superuser"})
        assert response.status_code == 400
