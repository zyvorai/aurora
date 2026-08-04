"""Wave 4 success & intelligence tests."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from gtm_api.models import Opportunity
from gtm_api.services.customer_success import (
    build_cs_brief,
    build_playbook,
    score_health,
)
from gtm_api.services.campaign_monitor import get_campaign_status
from gtm_api.services.crm_sync import sync_status
from gtm_api.services.insights import _snapshot_is_fresh


class TestCustomerSuccess:
    def test_score_health_closed_won(self):
        metrics = {"stage": "closed_won", "activity_count": 3, "has_proposal": True, "days_in_stage": 10}
        score, status = score_health(metrics)
        assert score >= 70
        assert status == "healthy"

    def test_score_health_stale_at_risk(self):
        metrics = {"stage": "proposal", "activity_count": 0, "has_proposal": False, "days_in_stage": 100}
        score, status = score_health(metrics)
        assert score < 70
        assert status in ("at_risk", "churned")

    def test_build_playbook_includes_qbr_for_closed_won(self):
        opp = Opportunity(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            product_id=uuid.uuid4(),
            name="Acme",
            company="Acme Corp",
            stage="closed_won",
        )
        playbook = build_playbook(opp, {"activity_count": 1})
        assert playbook["renewal_focus"] is True
        assert any("QBR" in s["action"] for s in playbook["steps"])

    def test_build_cs_brief_t0(self):
        opp = Opportunity(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            product_id=uuid.uuid4(),
            name="Acme",
            company="Acme Corp",
            stage="closed_won",
        )
        brief = build_cs_brief(opp, {"activity_count": 2, "days_in_stage": 5}, 85.0, "healthy")
        assert brief["compute_tier"] == "T0"
        assert brief["health_score"] == 85.0
        assert len(brief["recommendations"]) >= 1


class TestCampaignMonitor:
    @pytest.mark.asyncio
    async def test_get_campaign_status_not_found(self):
        mock_db = AsyncMock()
        mock_db.get = AsyncMock(return_value=None)
        result = await get_campaign_status(mock_db, uuid.uuid4(), uuid.uuid4())
        assert result is None


class TestInsights:
    def test_snapshot_fresh_within_week(self):
        snap = MagicMock()
        snap.updated_at = datetime.now(timezone.utc)
        assert _snapshot_is_fresh(snap) is True

    def test_snapshot_stale_after_week(self):
        snap = MagicMock()
        snap.updated_at = datetime(2020, 1, 1, tzinfo=timezone.utc)
        assert _snapshot_is_fresh(snap) is False


class TestCRMSync:
    def test_sync_disabled_in_minimal(self, monkeypatch):
        monkeypatch.setenv("DEPLOYMENT_PROFILE", "minimal")
        from gtm_api.config import get_settings
        get_settings.cache_clear()
        status = sync_status()
        assert status["enabled"] is False

    @pytest.mark.asyncio
    async def test_sync_returns_disabled_message(self, monkeypatch):
        monkeypatch.setenv("ENABLE_EXTERNAL_CRM_SYNC", "false")
        from gtm_api.config import get_settings
        get_settings.cache_clear()
        from gtm_api.services.crm_sync import sync_opportunities_to_external

        mock_db = AsyncMock()
        result = await sync_opportunities_to_external(mock_db, uuid.uuid4(), uuid.uuid4())
        assert result["synced"] is False
