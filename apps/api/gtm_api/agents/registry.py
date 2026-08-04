"""Central registry for GTM agents (11-agent catalog + legacy routes)."""

from __future__ import annotations

from dataclasses import dataclass

from gtm_api.agents.base import ComputeTier


@dataclass(frozen=True)
class AgentSpec:
    agent_id: str
    display_name: str
    compute_tier: ComputeTier
    async_required: bool
    implemented: bool
    model_key: str
    legacy_module: str | None = None
    supervisor_route: str | None = None
    description: str = ""


# 11-agent catalog (Wave 1 metadata; unimplemented agents return not_implemented)
AGENT_REGISTRY: dict[str, AgentSpec] = {
    "product": AgentSpec(
        agent_id="product",
        display_name="Product Agent",
        compute_tier=ComputeTier.T2,
        async_required=True,
        implemented=True,
        model_key="product",
        legacy_module="product_understanding",
        supervisor_route="discovery",
        description="Ingest docs and build product profile",
    ),
    "market_research": AgentSpec(
        agent_id="market_research",
        display_name="Market Research Agent",
        compute_tier=ComputeTier.T2,
        async_required=True,
        implemented=True,
        model_key="market_research",
        legacy_module="marketing_strategy",
        supervisor_route="marketing",
        description="ICP, personas, GTM strategy",
    ),
    "lead_discovery": AgentSpec(
        agent_id="lead_discovery",
        display_name="Lead Discovery Agent",
        compute_tier=ComputeTier.T1,
        async_required=False,
        implemented=True,
        model_key="lead_discovery",
        description="Find target accounts and personas",
    ),
    "lead_qualification": AgentSpec(
        agent_id="lead_qualification",
        display_name="Lead Qualification Agent",
        compute_tier=ComputeTier.T0,
        async_required=False,
        implemented=True,
        model_key="lead_qualification",
        legacy_module="sales_agent",
        supervisor_route="sales",
        description="Score leads and sales chat",
    ),
    "outreach": AgentSpec(
        agent_id="outreach",
        display_name="Outreach Agent",
        compute_tier=ComputeTier.T2,
        async_required=False,
        implemented=True,
        model_key="outreach",
        legacy_module="outreach",
        supervisor_route="outreach",
        description="Personalized outreach sequences",
    ),
    "campaign": AgentSpec(
        agent_id="campaign",
        display_name="Campaign Agent",
        compute_tier=ComputeTier.T1,
        async_required=True,
        implemented=True,
        model_key="campaign",
        legacy_module="content_studio",
        supervisor_route="content",
        description="Content and campaign assets",
    ),
    "sales_engineer": AgentSpec(
        agent_id="sales_engineer",
        display_name="Sales Engineer Agent",
        compute_tier=ComputeTier.T2,
        async_required=False,
        implemented=True,
        model_key="sales_engineer",
        legacy_module="solution_architect",
        supervisor_route="solution",
        description="Technical Q&A and architecture",
    ),
    "proposal": AgentSpec(
        agent_id="proposal",
        display_name="Proposal Agent",
        compute_tier=ComputeTier.T2,
        async_required=True,
        implemented=True,
        model_key="proposal",
        legacy_module="proposal_generator",
        supervisor_route="proposal",
        description="Proposals, SOW, ROI",
    ),
    "crm": AgentSpec(
        agent_id="crm",
        display_name="CRM Agent",
        compute_tier=ComputeTier.T0,
        async_required=False,
        implemented=True,
        model_key="crm",
        description="Pipeline and opportunity management",
    ),
    "customer_success": AgentSpec(
        agent_id="customer_success",
        display_name="Customer Success Agent",
        compute_tier=ComputeTier.T1,
        async_required=True,
        implemented=True,
        model_key="customer_success",
        description="Adoption, health, renewals",
    ),
    "analytics": AgentSpec(
        agent_id="analytics",
        display_name="Analytics Agent",
        compute_tier=ComputeTier.T0,
        async_required=False,
        implemented=True,
        model_key="analytics",
        supervisor_route="analytics",
        description="Funnel and KPI aggregates",
    ),
}

# Supervisor request_type → registry agent_id
REQUEST_TYPE_TO_AGENT: dict[str, str] = {
    "ingest": "product",
    "understand": "product",
    "refresh": "product",
    "strategy": "market_research",
    "market_research": "market_research",
    "discover_leads": "lead_discovery",
    "qualify_leads": "lead_qualification",
    "content": "campaign",
    "publish": "campaign",
    "query": "lead_qualification",
    "chat": "lead_qualification",
    "outreach": "outreach",
    "architect": "sales_engineer",
    "proposal": "proposal",
    "analytics": "analytics",
    "crm": "crm",
    "create_opportunity": "crm",
    "update_stage": "crm",
    "pipeline_summary": "crm",
    "success_plan": "customer_success",
    "cs_brief": "customer_success",
    "account_health": "customer_success",
}

# Legacy supervisor graph route keys (unchanged for routing tests)
REQUEST_TYPE_TO_ROUTE: dict[str, str] = {
    "ingest": "discovery",
    "understand": "discovery",
    "refresh": "learning",
    "strategy": "marketing",
    "content": "content",
    "publish": "content",
    "query": "sales",
    "chat": "sales",
    "outreach": "outreach",
    "architect": "solution",
    "proposal": "proposal",
    "analytics": "analytics",
}

# Map legacy llm.py agent keys to registry ids
LEGACY_MODEL_KEY_ALIASES: dict[str, str] = {
    "product_understanding": "product",
    "marketing_strategy": "market_research",
    "content_studio": "campaign",
    "sales_agent": "lead_qualification",
    "solution_architect": "sales_engineer",
    "proposal_generator": "proposal",
}


def get_agent_spec(agent_id: str) -> AgentSpec | None:
    return AGENT_REGISTRY.get(agent_id)


def resolve_agent_for_request(request_type: str) -> AgentSpec | None:
    agent_id = REQUEST_TYPE_TO_AGENT.get(request_type)
    if not agent_id:
        return AGENT_REGISTRY.get("lead_qualification")
    return AGENT_REGISTRY.get(agent_id)


def list_agents(*, implemented_only: bool = False) -> list[AgentSpec]:
    agents = list(AGENT_REGISTRY.values())
    if implemented_only:
        return [a for a in agents if a.implemented]
    return agents
