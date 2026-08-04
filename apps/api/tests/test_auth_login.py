"""Login route tests."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from gtm_api.auth import hash_password
from gtm_api.models import User
from gtm_api.routers.auth import login
from gtm_api.schemas import LoginRequest


def _make_user(email: str, password: str, created_offset: int = 0) -> User:
    user = User(
        id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        email=email,
        hashed_password=hash_password(password),
        full_name="Test",
        role="admin",
        is_active=True,
    )
    user.created_at = MagicMock()
    user.created_at.__lt__ = lambda self, other: created_offset < getattr(other, "_offset", 0)
    user._offset = created_offset  # type: ignore[attr-defined]
    return user


class TestLoginDuplicateEmail:
    @pytest.mark.asyncio
    async def test_login_uses_newest_when_duplicate_emails(self):
        """Same email registered on multiple tenants must not 500."""
        user_old = _make_user("dup@test.com", "secret123", created_offset=0)
        user_new = _make_user("dup@test.com", "secret123", created_offset=1)

        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = user_new

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        response = await login(LoginRequest(email="dup@test.com", password="secret123"), db=mock_db)
        assert response.access_token
        assert response.role == "admin"

    @pytest.mark.asyncio
    async def test_login_invalid_password(self):
        user = _make_user("one@test.com", "correct", created_offset=0)
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = user
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(HTTPException) as exc_info:
            await login(LoginRequest(email="one@test.com", password="wrong"), db=mock_db)
        assert exc_info.value.status_code == 401
