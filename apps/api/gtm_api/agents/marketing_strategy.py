"""Marketing Strategy LangGraph agent (Phase 2)."""

import json
import uuid
from typing import TypedDict

from langgraph.graph import END, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import content_hash
from gtm_api.config import get_settings
from gtm_api.services.llm import get_chat_model
from gtm_api.models import ApprovalStatus, Artifact, ArtifactType, Product
from gtm_api.services.citation_gate import (
    SYSTEM_PROMPT_GROUNDED,
    build_context_from_results,
    extract_citations_from_response,
    verify_grounding,
)
from gtm_api.services.embeddings import embedding_service
from gtm_api.services.vector_store import vector_store
from gtm_api.tenant import record_usage

settings = get_settings()

STRATEGY_PROMPT = """Based on the product profile and documentation, create a comprehensive GTM marketing strategy.

Product Profile:
{profile}

Documentation Sources:
{context}

Return a JSON object with:
- gtm_strategy: overall go-to-market strategy (2-3 paragraphs)
- icp: ideal customer profile description
- personas: list of {name, title, pain_points, goals, messaging} objects
- positioning: positioning statement
- messaging_hierarchy: {primary, secondary, proof_points} object
- value_propositions: list of value propositions
- objection_handling: list of {objection, response} objects
- competitive_comparison: list of {competitor, our_advantage} objects
- seo_keywords: list of target SEO keywords
- content_calendar: list of {week, topic, channel, content_type} for 4 weeks
"""


class StrategyState(TypedDict):
    product_id: str
    tenant_id: str
    profile: dict
    context: str
    focus_areas: list[str]
    strategy: dict
    tokens_used: int


async def retrieve_strategy_context(state: StrategyState) -> StrategyState:
    query = "marketing positioning value proposition target customers competitive advantage"
    vector = await embedding_service.embed_query(query)
    results = await vector_store.search(
        uuid.UUID(state["tenant_id"]),
        uuid.UUID(state["product_id"]),
        vector,
        limit=8,
    )
    state["context"] = build_context_from_results(results)
    return state


async def generate_strategy(state: StrategyState) -> StrategyState:
    llm = get_chat_model("marketing_strategy", temperature=0.3)

    prompt = STRATEGY_PROMPT.format(
        profile=json.dumps(state["profile"], indent=2),
        context=state["context"],
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
        strategy = json.loads(content.strip())
    except (json.JSONDecodeError, IndexError):
        strategy = {"gtm_strategy": response.content}

    state["strategy"] = strategy
    state["tokens_used"] = state.get("tokens_used", 0) + 2000
    return state


def build_strategy_graph() -> StateGraph:
    graph = StateGraph(StrategyState)
    graph.add_node("retrieve", retrieve_strategy_context)
    graph.add_node("generate", generate_strategy)
    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", END)
    return graph


async def run_marketing_strategy(
    db: AsyncSession,
    product: Product,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    focus_areas: list[str] | None = None,
) -> Artifact:
    graph = build_strategy_graph()
    app = graph.compile()

    result = await app.ainvoke({
        "product_id": str(product.id),
        "tenant_id": str(tenant_id),
        "profile": product.profile or {},
        "context": "",
        "focus_areas": focus_areas or [],
        "strategy": {},
        "tokens_used": 0,
    })

    strategy = result["strategy"]
    content = json.dumps(strategy, indent=2)

    artifact = Artifact(
        product_id=product.id,
        tenant_id=tenant_id,
        artifact_type=ArtifactType.STRATEGY,
        title=f"GTM Strategy - {product.name}",
        content=content,
        content_hash=content_hash(content),
        status=ApprovalStatus.DRAFT,
        metadata_=strategy,
        created_by=user_id,
    )
    db.add(artifact)
    await record_usage(db, tenant_id, tokens=result.get("tokens_used", 0), agent_runs=1)
    return artifact
