"""Default admin seed (marketing@zyvor.dev / Admin@321): idempotent creation, never
resets an existing account's password."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from gtm_api.auth import verify_password
from gtm_api.models import PlanTier, Tenant, User
from gtm_api.services.bootstrap import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_TENANT_SLUG,
    seed_default_admin,
)


class TestSeedDefaultAdmin:
    @pytest.mark.asyncio
    async def test_creates_tenant_and_admin_when_absent(self):
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: None),  # no existing user
                MagicMock(scalar_one_or_none=lambda: None),  # no existing tenant
            ]
        )
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.commit = AsyncMock()

        created = await seed_default_admin(mock_db)

        assert created is True
        added = [call.args[0] for call in mock_db.add.call_args_list]
        tenant = next(o for o in added if isinstance(o, Tenant))
        user = next(o for o in added if isinstance(o, User))
        assert tenant.slug == DEFAULT_TENANT_SLUG
        assert user.email == DEFAULT_ADMIN_EMAIL
        assert user.role == "admin"
        assert verify_password(DEFAULT_ADMIN_PASSWORD, user.hashed_password)

    @pytest.mark.asyncio
    async def test_noop_when_admin_already_exists(self):
        existing_user = User(
            id=uuid.uuid4(), tenant_id=uuid.uuid4(), email=DEFAULT_ADMIN_EMAIL,
            hashed_password="already-hashed", role="admin",
        )
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: existing_user))
        mock_db.add = MagicMock()

        created = await seed_default_admin(mock_db)

        assert created is False
        mock_db.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_reuses_existing_tenant_if_present(self):
        tenant_id = uuid.uuid4()
        existing_tenant = Tenant(id=tenant_id, name="Admin", slug=DEFAULT_TENANT_SLUG, plan=PlanTier.ENTERPRISE)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: None),  # no existing user
                MagicMock(scalar_one_or_none=lambda: existing_tenant),  # tenant exists
            ]
        )
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.commit = AsyncMock()

        created = await seed_default_admin(mock_db)

        assert created is True
        added = [call.args[0] for call in mock_db.add.call_args_list]
        assert all(not isinstance(o, Tenant) for o in added)  # didn't create a duplicate tenant
        user = next(o for o in added if isinstance(o, User))
        assert user.tenant_id == tenant_id
