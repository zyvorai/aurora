"""Tests for agent registry, executor, and supervisor integration."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from gtm_api.agents.base import AgentOutput
from gtm_api.agents.executor import dispatch_agent
from gtm_api.agents.registry import (
    AGENT_REGISTRY,
    REQUEST_TYPE_TO_AGENT,
    get_agent_spec,
    list_agents,
    resolve_agent_for_request,
)
from gtm_api.agents.supervisor import route_request, run_supervisor
from gtm_api.models import Product


class TestAgentRegistry:
    def test_catalog_has_eleven_agents(self):
        assert len(AGENT_REGISTRY) == 11

    def test_implemented_agents(self):
        implemented = [a.agent_id for a in list_agents(implemented_only=True)]
        assert "product" in implemented
        assert "market_research" in implemented
        assert "lead_discovery" in implemented
        assert "crm" in implemented
        assert "customer_success" in implemented

    def test_resolve_strategy_to_market_research(self):
        spec = resolve_agent_for_request("strategy")
        assert spec is not None
        assert spec.agent_id == "market_research"

    @pytest.mark.parametrize("request_type,agent_id", list(REQUEST_TYPE_TO_AGENT.items()))
    def test_request_type_mapping(self, request_type, agent_id):
        spec = resolve_agent_for_request(request_type)
        assert spec is not None
        assert spec.agent_id == agent_id

    def test_get_agent_spec(self):
        spec = get_agent_spec("sales_engineer")
        assert spec is not None
        assert spec.legacy_module == "solution_architect"


class TestSupervisorExecution:
    @pytest.mark.asyncio
    async def test_dispatch_analytics_no_llm(self):
        product = Product(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            name="Test",
            profile_status="ready",
            profile={"summary": "test"},
        )
        mock_db = AsyncMock()
        mock_analytics = AsyncMock(
            return_value={
                "period": "2026-08",
                "metrics": {},
                "funnel": {},
                "top_questions": [],
                "knowledge_gaps": [],
            }
        )
        with patch("gtm_api.agents.executor.get_analytics", mock_analytics):
            output = await dispatch_agent(
                mock_db,
                product,
                product.tenant_id,
                uuid.uuid4(),
                "analytics",
                {},
            )
        assert output.status == "completed"
        assert output.agent_id == "analytics"
        mock_analytics.assert_called_once()

    @pytest.mark.asyncio
    async def test_dispatch_lead_discovery_no_llm(self):
        product = Product(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            name="Test",
            profile={"industries": ["fintech"]},
        )
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))
        mock_db.flush = AsyncMock()

        output = await dispatch_agent(
            mock_db,
            product,
            product.tenant_id,
            uuid.uuid4(),
            "discover_leads",
            {"focus_industries": ["fintech"], "max_leads": 3},
        )
        assert output.status == "completed"
        assert output.agent_id == "lead_discovery"
        assert output.artifacts["discovered_count"] >= 1

    @pytest.mark.asyncio
    async def test_dispatch_crm_create_no_llm(self):
        product = Product(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            name="Test",
        )
        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()

        output = await dispatch_agent(
            mock_db,
            product,
            product.tenant_id,
            uuid.uuid4(),
            "create_opportunity",
            {"name": "Big Deal", "company": "Acme"},
        )
        assert output.status == "completed"
        assert output.agent_id == "crm"
        assert output.artifacts["opportunity"]["name"] == "Big Deal"

    @pytest.mark.asyncio
    async def test_run_supervisor_strategy_mocked(self):
        tenant_id = uuid.uuid4()
        user_id = uuid.uuid4()
        product = Product(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            name="Zyvor",
            profile_status="ready",
            profile={"summary": "AI dev tools"},
        )
        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock()
        mock_db.get = AsyncMock(return_value=product)

        strategy_payload = {
            "strategy": {"gtm_strategy": "Go to market", "icp": "CTOs"},
            "tokens_used": 100,
        }

        mock_artifact = MagicMock()
        mock_artifact.id = uuid.uuid4()

        with patch(
            "gtm_api.agents.executor.invoke_marketing_strategy",
            AsyncMock(return_value=strategy_payload),
        ):
            with patch("gtm_api.agents.executor.record_usage", AsyncMock()):
                with patch("gtm_api.agents.executor.Artifact") as artifact_cls:
                    artifact_cls.return_value = mock_artifact
                    result = await run_supervisor(
                        mock_db,
                        product,
                        tenant_id,
                        user_id,
                        "strategy",
                        {"focus_areas": ["fintech"]},
                    )

        assert result["request_type"] == "strategy"
        assert result["routed_agent"] == "marketing"
        assert result["result"]["status"] == "completed"
        assert result["result"]["agent_id"] == "market_research"
        assert "strategy" in result["result"]["artifacts"]

    def test_route_request_unchanged(self):
        state = {"request_type": "strategy", "routed_agent": ""}
        route_request(state)
        assert state["routed_agent"] == "marketing"
