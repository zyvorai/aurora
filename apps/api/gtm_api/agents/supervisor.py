"""Multi-Agent Supervisor (Phase 11)."""

import uuid
from enum import Enum
from typing import TypedDict

from langgraph.graph import END, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import Product


class AgentType(str, Enum):
    DISCOVERY = "discovery"
    MARKETING = "marketing"
    SALES = "sales"
    SOLUTION = "solution"
    CONTENT = "content"
    OUTREACH = "outreach"
    PROPOSAL = "proposal"
    ANALYTICS = "analytics"
    LEARNING = "learning"


class SupervisorState(TypedDict):
    tenant_id: str
    product_id: str
    user_id: str
    request_type: str
    input_data: dict
    routed_agent: str
    result: dict


def route_request(state: SupervisorState) -> str:
    request_type = state.get("request_type", "")

    routing = {
        "ingest": AgentType.DISCOVERY.value,
        "understand": AgentType.DISCOVERY.value,
        "query": AgentType.SALES.value,
        "chat": AgentType.SALES.value,
        "strategy": AgentType.MARKETING.value,
        "content": AgentType.CONTENT.value,
        "outreach": AgentType.OUTREACH.value,
        "architect": AgentType.SOLUTION.value,
        "proposal": AgentType.PROPOSAL.value,
        "analytics": AgentType.ANALYTICS.value,
        "refresh": AgentType.LEARNING.value,
        "publish": AgentType.CONTENT.value,
    }

    state["routed_agent"] = routing.get(request_type, AgentType.SALES.value)
    return state["routed_agent"]


async def execute_discovery(state: SupervisorState) -> SupervisorState:
    state["result"] = {"agent": "discovery", "status": "routed"}
    return state


async def execute_marketing(state: SupervisorState) -> SupervisorState:
    state["result"] = {"agent": "marketing", "status": "routed"}
    return state


async def execute_sales(state: SupervisorState) -> SupervisorState:
    state["result"] = {"agent": "sales", "status": "routed"}
    return state


async def execute_content(state: SupervisorState) -> SupervisorState:
    state["result"] = {"agent": "content", "status": "routed"}
    return state


async def execute_outreach(state: SupervisorState) -> SupervisorState:
    state["result"] = {"agent": "outreach", "status": "routed"}
    return state


async def execute_solution(state: SupervisorState) -> SupervisorState:
    state["result"] = {"agent": "solution", "status": "routed"}
    return state


async def execute_proposal(state: SupervisorState) -> SupervisorState:
    state["result"] = {"agent": "proposal", "status": "routed"}
    return state


async def execute_analytics(state: SupervisorState) -> SupervisorState:
    state["result"] = {"agent": "analytics", "status": "routed"}
    return state


async def execute_learning(state: SupervisorState) -> SupervisorState:
    state["result"] = {"agent": "learning", "status": "routed"}
    return state


def build_supervisor_graph() -> StateGraph:
    graph = StateGraph(SupervisorState)

    graph.add_node("route", route_request)
    graph.add_node("discovery", execute_discovery)
    graph.add_node("marketing", execute_marketing)
    graph.add_node("sales", execute_sales)
    graph.add_node("content", execute_content)
    graph.add_node("outreach", execute_outreach)
    graph.add_node("solution", execute_solution)
    graph.add_node("proposal", execute_proposal)
    graph.add_node("analytics", execute_analytics)
    graph.add_node("learning", execute_learning)

    graph.set_entry_point("route")

    graph.add_conditional_edges("route", lambda s: s["routed_agent"], {
        "discovery": "discovery",
        "marketing": "marketing",
        "sales": "sales",
        "content": "content",
        "outreach": "outreach",
        "solution": "solution",
        "proposal": "proposal",
        "analytics": "analytics",
        "learning": "learning",
    })

    for agent in ["discovery", "marketing", "sales", "content", "outreach",
                   "solution", "proposal", "analytics", "learning"]:
        graph.add_edge(agent, END)

    return graph


async def run_supervisor(
    db: AsyncSession,
    product: Product,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    request_type: str,
    input_data: dict,
) -> dict:
    graph = build_supervisor_graph()
    app = graph.compile()

    result = await app.ainvoke({
        "tenant_id": str(tenant_id),
        "product_id": str(product.id),
        "user_id": str(user_id),
        "request_type": request_type,
        "input_data": input_data,
        "routed_agent": "",
        "result": {},
    })

    return result
