"""Market Research agent — ICP, trends, competitors (split from full GTM strategy)."""

import json
import uuid
from typing import TypedDict

from langgraph.graph import END, StateGraph

from gtm_api.config import get_settings
from gtm_api.services.llm import get_chat_model
from gtm_api.services.citation_gate import SYSTEM_PROMPT_GROUNDED, build_context_from_results
from gtm_api.services.chunking import compact_profile, truncate_to_token_budget
from gtm_api.services.embeddings import LLMServiceError, embedding_service
from gtm_api.services.vector_store import vector_store

settings = get_settings()

MARKET_RESEARCH_PROMPT = """Based on the product profile and documentation, produce a market research brief.

Product Profile:
{profile}

Documentation Sources:
{context}

Focus industries: {focus_areas}

Return a JSON object with:
- target_industries: list of industries ranked by fit
- market_trends: list of {{trend, impact, relevance}} objects
- tam_signals: short TAM/SAM narrative (2-3 sentences)
- competitors: list of {{name, positioning, weakness}} objects
- icp: ideal customer profile (1 paragraph)
- personas: list of {{name, title, pain_points, goals}} objects
- seo_themes: list of keyword themes
"""


class MarketResearchState(TypedDict):
    product_id: str
    tenant_id: str
    profile: dict
    context: str
    focus_areas: list[str]
    brief: dict
    tokens_used: int


async def retrieve_market_context(state: MarketResearchState) -> MarketResearchState:
    query = "target market industry trends competitors TAM ideal customer"
    vector = await embedding_service.embed_query(query)
    results = await vector_store.search(
        uuid.UUID(state["tenant_id"]),
        uuid.UUID(state["product_id"]),
        vector,
        limit=4,
    )
    state["context"] = build_context_from_results(results, max_content_tokens=350)
    return state


async def generate_market_brief(state: MarketResearchState) -> MarketResearchState:
    llm = get_chat_model("market_research", temperature=0.3)
    profile_json = json.dumps(compact_profile(state["profile"]), indent=2)
    context = truncate_to_token_budget(state["context"], 1800)
    focus = ", ".join(state.get("focus_areas") or []) or "general B2B SaaS"

    prompt = MARKET_RESEARCH_PROMPT.format(
        profile=profile_json,
        context=context,
        focus_areas=focus,
    )
    try:
        response = await llm.ainvoke([
            {"role": "system", "content": SYSTEM_PROMPT_GROUNDED},
            {"role": "user", "content": prompt},
        ])
    except Exception as exc:
        raise LLMServiceError(
            f"Market research failed: {exc}",
            provider=settings.resolved_llm_provider(),
        ) from exc

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        brief = json.loads(content.strip())
    except (json.JSONDecodeError, IndexError):
        brief = {"icp": response.content, "market_trends": []}

    state["brief"] = brief
    state["tokens_used"] = state.get("tokens_used", 0) + 1500
    return state


def build_market_research_graph() -> StateGraph:
    graph = StateGraph(MarketResearchState)
    graph.add_node("retrieve", retrieve_market_context)
    graph.add_node("generate", generate_market_brief)
    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", END)
    return graph


async def invoke_market_research(
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
    profile: dict,
    focus_areas: list[str] | None = None,
) -> dict:
    graph = build_market_research_graph()
    app = graph.compile()
    return await app.ainvoke({
        "product_id": str(product_id),
        "tenant_id": str(tenant_id),
        "profile": profile,
        "context": "",
        "focus_areas": focus_areas or [],
        "brief": {},
        "tokens_used": 0,
    })
