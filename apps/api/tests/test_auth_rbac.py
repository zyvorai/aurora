"""Unit tests for JWT auth and RBAC permissions."""

import uuid

import pytest
from fastapi import HTTPException
from jose import jwt

from gtm_api.auth import ROLE_PERMISSIONS, create_access_token, require_permission
from gtm_api.config import get_settings
from gtm_api.models import User


def _user(role: str) -> User:
    return User(
        id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        email="test@example.com",
        hashed_password="x",
        full_name="Test",
        role=role,
        is_active=True,
    )


class TestJWT:
    def test_create_access_token_decodes(self):
        settings = get_settings()
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        token = create_access_token(user_id, tenant_id, "admin")
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert payload["sub"] == str(user_id)
        assert payload["tenant_id"] == str(tenant_id)
        assert payload["role"] == "admin"


class TestRBAC:
    @pytest.mark.asyncio
    async def test_admin_has_publish_permission(self):
        checker = require_permission("publish")
        user = await checker(user=_user("admin"))
        assert user.role == "admin"

    @pytest.mark.asyncio
    async def test_viewer_cannot_write(self):
        checker = require_permission("write")
        with pytest.raises(HTTPException) as exc_info:
            await checker(user=_user("viewer"))
        assert exc_info.value.status_code == 403

    def test_role_permission_matrix(self):
        assert "publish" in ROLE_PERMISSIONS["admin"]
        assert "approve" in ROLE_PERMISSIONS["approver"]
        assert "write" not in ROLE_PERMISSIONS["viewer"]
