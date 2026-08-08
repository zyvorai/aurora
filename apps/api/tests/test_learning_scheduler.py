"""Scheduled learning sweep (Phase 10): refresh_all_active_products iterates every
active product and tolerates per-product failures without aborting the whole sweep."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from gtm_api.models import Product
from gtm_api.services.learning import refresh_all_active_products


def _product(tenant_id=None):
    return Product(id=uuid.uuid4(), tenant_id=tenant_id or uuid.uuid4(), name="Acme", is_active=True)


class TestRefreshAllActiveProducts:
    @pytest.mark.asyncio
    async def test_sweeps_every_active_product(self):
        products = [_product(), _product(), _product()]
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: products)))

        with patch(
            "gtm_api.services.learning.refresh_product",
            AsyncMock(return_value={"sources_refreshed": 0, "refresh_details": [], "stale_artifacts_flagged": 0}),
        ) as mock_refresh:
            result = await refresh_all_active_products(mock_db)

        assert mock_refresh.await_count == 3
        assert result["products_checked"] == 3
        assert result["products_with_changes"] == 0
        assert result["failures"] == []

    @pytest.mark.asyncio
    async def test_counts_products_with_actual_changes(self):
        products = [_product(), _product()]
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: products)))

        outcomes = [
            {"sources_refreshed": 2, "refresh_details": [], "stale_artifacts_flagged": 0},
            {"sources_refreshed": 0, "refresh_details": [], "stale_artifacts_flagged": 0},
        ]
        with patch("gtm_api.services.learning.refresh_product", AsyncMock(side_effect=outcomes)):
            result = await refresh_all_active_products(mock_db)

        assert result["products_checked"] == 2
        assert result["products_with_changes"] == 1

    @pytest.mark.asyncio
    async def test_one_product_failure_does_not_abort_the_sweep(self):
        products = [_product(), _product()]
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: products)))

        async def _flaky(db, product_id, tenant_id):
            if product_id == products[0].id:
                raise RuntimeError("crawler exploded")
            return {"sources_refreshed": 1, "refresh_details": [], "stale_artifacts_flagged": 0}

        with patch("gtm_api.services.learning.refresh_product", side_effect=_flaky):
            result = await refresh_all_active_products(mock_db)

        assert result["products_checked"] == 2
        assert result["products_with_changes"] == 1
        assert result["failures"] == [str(products[0].id)]

    @pytest.mark.asyncio
    async def test_no_active_products_is_a_noop(self):
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [])))

        result = await refresh_all_active_products(mock_db)

        assert result == {"products_checked": 0, "products_with_changes": 0, "failures": []}
