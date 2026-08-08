"""Admin router tests: plan usage, suppression list, purge confirmation."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from gtm_api.models import PlanTier, Tenant, User
from gtm_api.routers.admin import get_plan_usage, purge_data
from gtm_api.schemas import PurgeRequest
from gtm_api.services.enterprise import count_active_products, list_suppressions


def _tenant(tenant_id, slug="acme", plan=PlanTier.GROWTH):
    return Tenant(id=tenant_id, name="Acme Inc", slug=slug, plan=plan, is_active=True)


def _user(tenant_id, role="admin"):
    return User(id=uuid.uuid4(), tenant_id=tenant_id, email="a@acme.com", hashed_password="x", role=role)


@pytest.mark.asyncio
async def test_count_active_products():
    tenant_id = uuid.uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [MagicMock(), MagicMock()])))

    count = await count_active_products(mock_db, tenant_id)
    assert count == 2


@pytest.mark.asyncio
async def test_list_suppressions_scoped_to_tenant():
    tenant_id = uuid.uuid4()
    entries = [MagicMock(), MagicMock()]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: entries)))

    result = await list_suppressions(mock_db, tenant_id)
    assert result == entries


@pytest.mark.asyncio
async def test_get_plan_usage_reports_limit_and_used():
    tenant_id = uuid.uuid4()
    tenant = _tenant(tenant_id, plan=PlanTier.GROWTH)
    user = _user(tenant_id)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: tenant),  # get_tenant_context
            MagicMock(scalars=lambda: MagicMock(all=lambda: [MagicMock(), MagicMock(), MagicMock()])),  # count_active_products
        ]
    )
    mock_db.get = AsyncMock(return_value=tenant)

    result = await get_plan_usage(user=user, db=mock_db)

    assert result.plan == "growth"
    assert result.usage["products_used"] == 3
    assert result.usage["products_limit"] == 10  # growth plan limit


@pytest.mark.asyncio
async def test_purge_rejects_mismatched_confirmation():
    tenant_id = uuid.uuid4()
    tenant = _tenant(tenant_id, slug="acme")
    user = _user(tenant_id)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: tenant))
    mock_db.get = AsyncMock(return_value=tenant)

    with pytest.raises(HTTPException) as exc_info:
        await purge_data(PurgeRequest(confirm="wrong-slug"), user=user, db=mock_db)
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_purge_succeeds_with_matching_slug():
    tenant_id = uuid.uuid4()
    tenant = _tenant(tenant_id, slug="acme")
    user = _user(tenant_id)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: tenant),  # get_tenant_context
            MagicMock(scalars=lambda: MagicMock(all=lambda: [])),  # purge_tenant_data's product lookup
        ]
    )
    mock_db.get = AsyncMock(return_value=tenant)
    mock_db.add = MagicMock()

    result = await purge_data(PurgeRequest(confirm="acme"), user=user, db=mock_db)

    assert result.status == "purged"
    assert result.tenant_id == str(tenant_id)
