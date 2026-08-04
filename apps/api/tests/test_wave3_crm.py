"""Wave 3 CRM tests — opportunities, stage moves (T0)."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from gtm_api.models import OPPORTUNITY_STAGES, Opportunity
from gtm_api.services.crm import (
    create_opportunity,
    pipeline_summary,
    update_opportunity_stage,
)


class TestCRMService:
    @pytest.mark.asyncio
    async def test_create_opportunity(self):
        tenant_id = uuid.uuid4()
        product_id = uuid.uuid4()
        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()

        opp = await create_opportunity(
            mock_db,
            tenant_id,
            product_id,
            name="Acme Deal",
            company="Acme Corp",
            stage="discovery",
        )
        assert opp.name == "Acme Deal"
        assert opp.company == "Acme Corp"
        assert opp.stage == "discovery"
        assert opp.probability == 0.1
        mock_db.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_stage_creates_activity(self):
        tenant_id = uuid.uuid4()
        opp = Opportunity(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            product_id=uuid.uuid4(),
            name="Deal",
            stage="discovery",
            probability=0.1,
        )
        mock_db = AsyncMock()
        mock_db.get = AsyncMock(return_value=opp)
        mock_db.flush = AsyncMock()

        updated = await update_opportunity_stage(
            mock_db, opp.id, tenant_id, "proposal", user_id=uuid.uuid4()
        )
        assert updated is not None
        assert updated.stage == "proposal"
        assert updated.probability == 0.5
        assert mock_db.add.call_count == 1

    def test_opportunity_stages_include_revenue(self):
        assert "technical_eval" in OPPORTUNITY_STAGES
        assert "proposal" in OPPORTUNITY_STAGES
        assert "closed_won" in OPPORTUNITY_STAGES

    @pytest.mark.asyncio
    async def test_pipeline_summary_empty(self):
        tenant_id = uuid.uuid4()
        product_id = uuid.uuid4()
        mock_db = AsyncMock()

        stage_result = MagicMock()
        stage_result.all.return_value = []
        list_result = MagicMock()
        list_result.scalars.return_value.all.return_value = []

        mock_db.execute = AsyncMock(return_value=stage_result)

        async def execute_side_effect(stmt):
            return stage_result

        mock_db.execute = AsyncMock(side_effect=execute_side_effect)

        from gtm_api.services import crm as crm_module

        original_list = crm_module.list_opportunities
        crm_module.list_opportunities = AsyncMock(return_value=[])
        try:
            summary = await pipeline_summary(mock_db, product_id, tenant_id)
        finally:
            crm_module.list_opportunities = original_list

        assert summary["total"] == 0
        assert summary["weighted_pipeline"] == 0.0
