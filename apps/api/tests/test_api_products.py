"""Product CRUD test (docs/gtm-platform-phases.md's test_api_products_crud).

Follows this suite's established convention (mocked AsyncSession, direct
router-function calls, no TestClient/dependency-override HTTP harness --
see test_wave0.py / test_wave2_pipeline.py / test_agent_registry.py).
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from gtm_api.models import PlanTier, Product, Tenant, User
from gtm_api.routers.products import create_product, get_product, list_products
from gtm_api.schemas import ProductCreate


def _tenant(tenant_id):
    return Tenant(id=tenant_id, name="Acme Inc", slug="acme", plan=PlanTier.GROWTH, is_active=True)


def _user(tenant_id, role="admin"):
    return User(id=uuid.uuid4(), tenant_id=tenant_id, email="a@acme.com", hashed_password="x", role=role)


@pytest.mark.asyncio
async def test_create_product_creates_website_source():
    tenant_id = uuid.uuid4()
    tenant = _tenant(tenant_id)
    user = _user(tenant_id)
    req = ProductCreate(name="Acme Widgets", website_url="https://acme.example.com", description=None)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: tenant),  # get_tenant_context
            MagicMock(scalars=lambda: MagicMock(all=lambda: [])),  # check_product_limit
        ]
    )
    mock_db.get = AsyncMock(return_value=tenant)
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()

    product = await create_product(req, user=user, db=mock_db)

    assert product.name == "Acme Widgets"
    assert product.tenant_id == tenant_id
    assert mock_db.add.call_count == 3  # product + auto-created website source + audit log


@pytest.mark.asyncio
async def test_create_product_blocked_at_plan_limit():
    tenant_id = uuid.uuid4()
    tenant = _tenant(tenant_id)
    user = _user(tenant_id)
    req = ProductCreate(name="One Too Many", website_url=None, description=None)

    existing_products = [MagicMock() for _ in range(10)]  # >= growth plan's product limit

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: tenant),
            MagicMock(scalars=lambda: MagicMock(all=lambda: existing_products)),
        ]
    )
    mock_db.get = AsyncMock(return_value=tenant)

    with pytest.raises(HTTPException) as exc_info:
        await create_product(req, user=user, db=mock_db)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_list_products_scoped_to_tenant():
    tenant_id = uuid.uuid4()
    tenant = _tenant(tenant_id)
    user = _user(tenant_id)
    products = [
        Product(id=uuid.uuid4(), tenant_id=tenant_id, name="A"),
        Product(id=uuid.uuid4(), tenant_id=tenant_id, name="B"),
    ]

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: tenant),
            MagicMock(scalars=lambda: MagicMock(all=lambda: products)),
        ]
    )

    result = await list_products(user=user, db=mock_db)
    assert result == products


@pytest.mark.asyncio
async def test_get_product_not_found_raises_404():
    tenant_id = uuid.uuid4()
    tenant = _tenant(tenant_id)
    user = _user(tenant_id)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: tenant),
            MagicMock(scalar_one_or_none=lambda: None),
        ]
    )

    with pytest.raises(HTTPException) as exc_info:
        await get_product(uuid.uuid4(), user=user, db=mock_db)
    assert exc_info.value.status_code == 404
