"""Solution Architect LangGraph agent (Phase 7)."""

import uuid
from typing import TypedDict

from langgraph.graph import END, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.config import get_settings
from gtm_api.services.llm import get_chat_model
from gtm_api.models import Product
from gtm_api.services.citation_gate import (
    SYSTEM_PROMPT_GROUNDED,
    verify_grounding,
)
from gtm_api.services.chunking import truncate_to_token_budget
from gtm_api.services.embeddings import LLMServiceError
from gtm_api.services.mcp import gather_decision_context
from gtm_api.tenant import record_usage

settings = get_settings()

ARCHITECT_PROMPT = """You are a solution architect. Answer this technical pre-sales question with detailed, accurate information.

Question: {question}
Additional Context: {context}

Multi-source platform context (sources: {sources}):
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
    sources_used: list[str]
    result: dict
    tokens_used: int


async def retrieve_architect_context(state: ArchitectState) -> ArchitectState:
    if state.get("docs_context"):
        return state

    decision_ctx = await gather_decision_context(
        state["question"],
        uuid.UUID(state["tenant_id"]),
        uuid.UUID(state["product_id"]),
        profile=state.get("profile"),
    )
    state["docs_context"] = decision_ctx.to_prompt_section(max_chars=6000)
    state["sources_used"] = decision_ctx.sources_used
    state["_search_results"] = decision_ctx.search_results  # type: ignore
    return state


async def generate_architect_response(state: ArchitectState) -> ArchitectState:
    llm = get_chat_model("solution_architect", temperature=0.2)

    prompt = ARCHITECT_PROMPT.format(
        question=state["question"],
        context=truncate_to_token_budget(state.get("extra_context", ""), 150),
        sources=", ".join(state.get("sources_used", [])),
        docs=truncate_to_token_budget(state["docs_context"], 5000),
    )

    try:
        response = await llm.ainvoke([
            {"role": "system", "content": SYSTEM_PROMPT_GROUNDED},
            {"role": "user", "content": prompt},
        ])
    except Exception as exc:
        message = str(exc)
        if "exceed_context_size" in message or "context size" in message.lower():
            raise LLMServiceError(
                "Architect prompt exceeds the model context window. "
                "Set OLLAMA_NUM_CTX=8192 in .env and restart the API.",
                provider="ollama",
            ) from exc
        if "connection" in message.lower():
            raise LLMServiceError(
                "Cannot reach Ollama. Run `ollama serve` and retry.",
                provider="ollama",
            ) from exc
        raise LLMServiceError(
            f"Architect request failed: {message}",
            provider=settings.resolved_llm_provider(),
        ) from exc

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


async def invoke_solution_architect(
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
    profile: dict,
    question: str,
    context: str | None = None,
    *,
    db: AsyncSession | None = None,
    product: Product | None = None,
) -> dict:
    """Run architect graph without holding a DB connection (unless db passed for MCP hub)."""
    graph = build_architect_graph()
    app = graph.compile()

    decision_ctx = await gather_decision_context(
        question,
        tenant_id,
        product_id,
        db=db,
        product=product,
        profile=profile,
    )

    result = await app.ainvoke({
        "product_id": str(product_id),
        "tenant_id": str(tenant_id),
        "profile": profile,
        "question": question,
        "extra_context": context or "",
        "docs_context": decision_ctx.to_prompt_section(max_chars=6000),
        "sources_used": decision_ctx.sources_used,
        "result": {},
        "tokens_used": 0,
        "_search_results": decision_ctx.search_results,
    })

    search_results = result.get("_search_results", [])  # type: ignore
    answer = result["result"].get("answer", "")
    grounding = verify_grounding(answer, search_results) if search_results else None

    return {
        "answer": answer,
        "architecture_diagram": result["result"].get("architecture_diagram"),
        "deployment_plan": result["result"].get("deployment_plan"),
        "security_notes": result["result"].get("security_notes"),
        "tokens_used": result.get("tokens_used", 0),
        "sources_used": result.get("sources_used", []),
        "citations": [
            {"chunk_id": c.chunk_id, "document_title": c.document_title, "excerpt": c.excerpt, "url": c.url}
            for c in (grounding.citations if grounding else [])
        ],
        "grounded": grounding.grounded if grounding else False,
    }


async def run_solution_architect(
    db: AsyncSession,
    product: Product,
    tenant_id: uuid.UUID,
    question: str,
    context: str | None = None,
) -> dict:
    payload = await invoke_solution_architect(
        product.id, tenant_id, product.profile or {}, question, context, db=db, product=product
    )
    await record_usage(db, tenant_id, tokens=payload.pop("tokens_used", 0), agent_runs=1)
    payload.pop("security_notes", None)
    return payload
