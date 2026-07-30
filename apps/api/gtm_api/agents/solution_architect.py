"""Solution Architect LangGraph agent (Phase 7)."""

import json
import uuid
from typing import TypedDict

from langgraph.graph import END, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.config import get_settings
from gtm_api.services.llm import get_chat_model
from gtm_api.models import Product
from gtm_api.services.citation_gate import (
    SYSTEM_PROMPT_GROUNDED,
    build_context_from_results,
    verify_grounding,
)
from gtm_api.services.embeddings import embedding_service
from gtm_api.services.vector_store import vector_store
from gtm_api.tenant import record_usage

settings = get_settings()

ARCHITECT_PROMPT = """You are a solution architect. Answer this technical pre-sales question with detailed, accurate information.

Question: {question}
Additional Context: {context}

Product Profile:
{profile}

Documentation:
{docs}

Provide:
1. A detailed technical answer
2. An architecture diagram in Mermaid syntax (if applicable)
3. A deployment plan with steps
4. Security considerations

Return JSON with: answer, architecture_diagram (mermaid), deployment_plan, security_notes
"""


class ArchitectState(TypedDict):
    product_id: str
    tenant_id: str
    profile: dict
    question: str
    extra_context: str
    docs_context: str
    result: dict
    tokens_used: int


async def retrieve_architect_context(state: ArchitectState) -> ArchitectState:
    vector = await embedding_service.embed_query(state["question"])
    results = await vector_store.search(
        uuid.UUID(state["tenant_id"]),
        uuid.UUID(state["product_id"]),
        vector,
        limit=8,
    )
    state["docs_context"] = build_context_from_results(results)
    state["_search_results"] = results  # type: ignore
    return state


async def generate_architect_response(state: ArchitectState) -> ArchitectState:
    llm = get_chat_model("solution_architect", temperature=0.2)

    prompt = ARCHITECT_PROMPT.format(
        question=state["question"],
        context=state.get("extra_context", ""),
        profile=json.dumps(state["profile"], indent=2),
        docs=state["docs_context"],
    )

    response = await llm.ainvoke([
        {"role": "system", "content": SYSTEM_PROMPT_GROUNDED},
        {"role": "user", "content": prompt},
    ])

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        result = json.loads(content.strip())
    except (json.JSONDecodeError, IndexError):
        result = {"answer": response.content}

    state["result"] = result
    state["tokens_used"] = state.get("tokens_used", 0) + 2000
    return state


def build_architect_graph() -> StateGraph:
    graph = StateGraph(ArchitectState)
    graph.add_node("retrieve", retrieve_architect_context)
    graph.add_node("generate", generate_architect_response)
    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", END)
    return graph


async def run_solution_architect(
    db: AsyncSession,
    product: Product,
    tenant_id: uuid.UUID,
    question: str,
    context: str | None = None,
) -> dict:
    graph = build_architect_graph()
    app = graph.compile()

    result = await app.ainvoke({
        "product_id": str(product.id),
        "tenant_id": str(tenant_id),
        "profile": product.profile or {},
        "question": question,
        "extra_context": context or "",
        "docs_context": "",
        "result": {},
        "tokens_used": 0,
    })

    await record_usage(db, tenant_id, tokens=result.get("tokens_used", 0), agent_runs=1)

    search_results = result.get("_search_results", [])  # type: ignore
    answer = result["result"].get("answer", "")
    grounding = verify_grounding(answer, search_results) if search_results else None

    return {
        "answer": answer,
        "architecture_diagram": result["result"].get("architecture_diagram"),
        "deployment_plan": result["result"].get("deployment_plan"),
        "citations": [
            {"chunk_id": c.chunk_id, "document_title": c.document_title, "excerpt": c.excerpt, "url": c.url}
            for c in (grounding.citations if grounding else [])
        ],
        "grounded": grounding.grounded if grounding else False,
    }
