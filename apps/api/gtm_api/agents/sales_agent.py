"""Sales Agent LangGraph agent (Phase 4)."""

import json
import uuid
from typing import TypedDict

from langgraph.graph import END, StateGraph
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.config import get_settings
from gtm_api.services.llm import get_chat_model
from gtm_api.models import Conversation, Lead, Product
from gtm_api.services.citation_gate import (
    SYSTEM_PROMPT_GROUNDED,
    build_context_from_results,
    verify_grounding,
)
from gtm_api.services.embeddings import embedding_service
from gtm_api.services.vector_store import vector_store
from gtm_api.tenant import record_usage

settings = get_settings()

SALES_SYSTEM = SYSTEM_PROMPT_GROUNDED + """
You are a knowledgeable sales engineer for this product. Help prospects understand the product technically.
Rules:
- Answer technical questions with citations from documentation
- Do NOT discuss specific pricing unless it appears in the sources
- Do NOT make commitments about SLAs, discounts, or contracts
- Qualify leads by understanding their needs, timeline, and technical requirements
- Suggest booking a demo when appropriate
- Be helpful, accurate, and professional
"""


class SalesState(TypedDict):
    product_id: str
    tenant_id: str
    session_id: str
    profile: dict
    message: str
    history: list[dict]
    context: str
    reply: str
    citations: list
    grounded: bool
    lead_score: float
    suggested_actions: list[str]
    tokens_used: int


async def retrieve_sales_context(state: SalesState) -> SalesState:
    vector = await embedding_service.embed_query(state["message"])
    results = await vector_store.search(
        uuid.UUID(state["tenant_id"]),
        uuid.UUID(state["product_id"]),
        vector,
        limit=5,
    )
    state["context"] = build_context_from_results(results)
    state["_search_results"] = results  # type: ignore
    return state


async def generate_reply(state: SalesState) -> SalesState:
    llm = get_chat_model("sales_agent", temperature=0.2)

    messages = [{"role": "system", "content": SALES_SYSTEM + f"\n\nProduct Profile:\n{json.dumps(state['profile'], indent=2)}"}]
    for msg in state.get("history", [])[-10:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({
        "role": "user",
        "content": f"{state['message']}\n\nRelevant Documentation:\n{state['context']}",
    })

    response = await llm.ainvoke(messages)
    state["reply"] = response.content

    search_results = state.get("_search_results", [])  # type: ignore
    grounding = verify_grounding(response.content, search_results)
    state["grounded"] = grounding.grounded
    state["citations"] = [
        {"chunk_id": c.chunk_id, "document_title": c.document_title, "excerpt": c.excerpt, "url": c.url}
        for c in grounding.citations
    ]

    score = min(grounding.confidence * 100, 100)
    if any(kw in state["message"].lower() for kw in ["demo", "pricing", "trial", "buy", "purchase"]):
        score += 20
    state["lead_score"] = min(score, 100)

    actions = []
    if score > 60:
        actions.append("Schedule demo")
    if "pricing" in state["message"].lower():
        actions.append("Connect with sales team")
    state["suggested_actions"] = actions
    state["tokens_used"] = state.get("tokens_used", 0) + 800
    return state


def build_sales_graph() -> StateGraph:
    graph = StateGraph(SalesState)
    graph.add_node("retrieve", retrieve_sales_context)
    graph.add_node("reply", generate_reply)
    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "reply")
    graph.add_edge("reply", END)
    return graph


async def run_sales_chat(
    db: AsyncSession,
    product: Product,
    tenant_id: uuid.UUID,
    message: str,
    session_id: str,
) -> dict:
    result = await db.execute(
        select(Conversation).where(
            Conversation.session_id == session_id,
            Conversation.product_id == product.id,
        )
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        conversation = Conversation(
            product_id=product.id,
            tenant_id=tenant_id,
            session_id=session_id,
            messages=[],
        )
        db.add(conversation)

    history = conversation.messages or []
    graph = build_sales_graph()
    app = graph.compile()

    agent_result = await app.ainvoke({
        "product_id": str(product.id),
        "tenant_id": str(tenant_id),
        "session_id": session_id,
        "profile": product.profile or {},
        "message": message,
        "history": history,
        "context": "",
        "reply": "",
        "citations": [],
        "grounded": False,
        "lead_score": 0.0,
        "suggested_actions": [],
        "tokens_used": 0,
    })

    history.append({"role": "user", "content": message})
    history.append({"role": "assistant", "content": agent_result["reply"]})
    conversation.messages = history
    conversation.lead_score = agent_result["lead_score"]

    if agent_result["lead_score"] > 70:
        lead = Lead(
            product_id=product.id,
            tenant_id=tenant_id,
            score=agent_result["lead_score"],
            stage="qualified",
            source="chat",
            metadata_={"session_id": session_id},
        )
        db.add(lead)

    await record_usage(db, tenant_id, tokens=agent_result.get("tokens_used", 0), agent_runs=1)

    return {
        "reply": agent_result["reply"],
        "citations": agent_result["citations"],
        "grounded": agent_result["grounded"],
        "lead_score": agent_result["lead_score"],
        "suggested_actions": agent_result["suggested_actions"],
    }
