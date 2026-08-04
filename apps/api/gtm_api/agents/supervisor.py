"""Multi-Agent Supervisor — routes and invokes registered agents."""

import uuid
from typing import TypedDict

from langgraph.graph import END, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.agents.executor import dispatch_agent
from gtm_api.agents.registry import REQUEST_TYPE_TO_ROUTE
from gtm_api.models import AgentRun, Product


class SupervisorState(TypedDict):
    tenant_id: str
    product_id: str
    user_id: str
    request_type: str
    input_data: dict
    routed_agent: str
    result: dict


def route_request(state: SupervisorState) -> SupervisorState:
    request_type = state.get("request_type", "")
    state["routed_agent"] = REQUEST_TYPE_TO_ROUTE.get(request_type, "sales")
    return state


def build_supervisor_graph(
    db: AsyncSession | None = None,
    product: Product | None = None,
    tenant_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
) -> StateGraph:
    """Build supervisor graph. When db/product context is provided, execute real agents."""

    async def execute_routed(state: SupervisorState) -> SupervisorState:
        if db is None or product is None or tenant_id is None or user_id is None:
            route = state.get("routed_agent", "sales")
            state["result"] = {"agent": route, "status": "routed"}
            return state

        output = await dispatch_agent(
            db,
            product,
            tenant_id,
            user_id,
            state["request_type"],
            state.get("input_data") or {},
        )
        state["result"] = output.to_dict()
        return state

    graph = StateGraph(SupervisorState)
    graph.add_node("route", route_request)
    graph.add_node("execute", execute_routed)
    graph.set_entry_point("route")
    graph.add_conditional_edges(
        "route",
        lambda s: s["routed_agent"],
        {route: "execute" for route in set(REQUEST_TYPE_TO_ROUTE.values())},
    )
    graph.add_edge("execute", END)
    return graph


async def run_supervisor(
    db: AsyncSession,
    product: Product,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    request_type: str,
    input_data: dict,
) -> dict:
    graph = build_supervisor_graph(db, product, tenant_id, user_id)
    app = graph.compile()

    agent_run = AgentRun(
        tenant_id=tenant_id,
        product_id=product.id,
        agent_type=request_type,
        thread_id=str(uuid.uuid4()),
        status="running",
        input_data=input_data,
    )
    db.add(agent_run)
    await db.flush()

    try:
        result = await app.ainvoke({
            "tenant_id": str(tenant_id),
            "product_id": str(product.id),
            "user_id": str(user_id),
            "request_type": request_type,
            "input_data": input_data,
            "routed_agent": "",
            "result": {},
        })

        output = result.get("result") or {}
        agent_run.status = "completed" if output.get("status") == "completed" else output.get("status", "completed")
        agent_run.output_data = output
        agent_run.tokens_used = output.get("tokens_used", 0)
        if output.get("status") == "failed":
            agent_run.error_message = output.get("error")
        await db.flush()

        return {
            "routed_agent": result.get("routed_agent"),
            "request_type": request_type,
            "agent_run_id": str(agent_run.id),
            "result": output,
        }
    except Exception as exc:
        agent_run.status = "failed"
        agent_run.error_message = str(exc)
        await db.flush()
        raise
