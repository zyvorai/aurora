"""Wave 0 lean runtime tests."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from gtm_api.config import get_settings
from gtm_api.models import Product
from gtm_api.services.brief import _build_narrative, build_executive_brief


class TestLeanConfig:
    def test_lean_profile_single_model(self, monkeypatch):
        monkeypatch.setenv("LLM_PROFILE", "lean")
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_DEFAULT_MODEL", "llama3.1:8b")
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        get_settings.cache_clear()
        settings = get_settings()
        assert settings.is_lean_profile()
        assert settings.get_agent_model("outreach") == "llama3.1:8b"
        assert settings.get_agent_model("marketing_strategy") == "llama3.1:8b"

    def test_minimal_deployment_disables_neo4j(self, monkeypatch):
        monkeypatch.setenv("DEPLOYMENT_PROFILE", "minimal")
        get_settings.cache_clear()
        settings = get_settings()
        assert settings.neo4j_enabled is False
        assert settings.redis_workers_enabled is False

    def test_burst_agent_uses_openai_when_configured(self, monkeypatch):
        monkeypatch.setenv("LLM_PROFILE", "lean")
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.setenv("LLM_BURST_AGENTS", "proposal_generator")
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        get_settings.cache_clear()
        settings = get_settings()
        assert settings.get_agent_model("proposal_generator") == "gpt-4o"
        assert settings.get_agent_model("sales_agent") == settings.ollama_default_model


class TestExecutiveBrief:
    def test_build_narrative_includes_risks(self):
        product = Product(id=uuid.uuid4(), tenant_id=uuid.uuid4(), name="Zyvor", profile_status="pending")
        narrative = _build_narrative(
            product,
            {"profile_built": False, "strategy_ready": False},
            {"leads": 0, "conversations": 0},
            ["Product profile not built"],
        )
        assert "Zyvor" in narrative
        assert "profile" in narrative.lower()

    @pytest.mark.asyncio
    async def test_build_executive_brief_no_llm(self, monkeypatch):
        product = Product(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            name="Test Product",
            profile_status="ready",
            profile={"summary": "test"},
        )
        tenant_id = product.tenant_id

        mock_db = AsyncMock()
        mock_analytics = AsyncMock(
            return_value={
                "period": "2026-08",
                "metrics": {},
                "funnel": {"conversations": 2, "artifacts_created": 1, "agent_runs": 3},
                "top_questions": [],
                "knowledge_gaps": [],
            }
        )

        scalar_results = [0, 0, 0, 0, 0]  # sources, completed, strategy, outreach, leads
        call_idx = {"n": 0}

        async def execute_side_effect(*args, **kwargs):
            idx = call_idx["n"]
            call_idx["n"] += 1
            if idx >= 5:
                result = MagicMock()
                result.scalar_one_or_none.return_value = None
                return result
            val = scalar_results[idx] if idx < len(scalar_results) else 0
            result = MagicMock()
            result.scalar.return_value = val
            return result

        mock_db.execute = AsyncMock(side_effect=execute_side_effect)

        monkeypatch.setattr("gtm_api.services.brief.get_analytics", mock_analytics)

        brief = await build_executive_brief(mock_db, tenant_id, product)

        assert brief["compute_tier"] == "T0"
        assert brief["product_name"] == "Test Product"
        assert "narrative" in brief
        mock_analytics.assert_called_once()
