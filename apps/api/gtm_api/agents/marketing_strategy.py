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
from gtm_api.services.chunking import compact_profile, truncate_to_token_budget
from gtm_api.services.embeddings import LLMServiceError, embedding_service
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
- personas: list of {{name, title, pain_points, goals, messaging}} objects
- positioning: positioning statement
- messaging_hierarchy: {{primary, secondary, proof_points}} object
- value_propositions: list of value propositions
- objection_handling: list of {{objection, response}} objects
- competitive_comparison: list of {{competitor, our_advantage}} objects
- seo_keywords: list of target SEO keywords
- content_calendar: list of {{week, topic, channel, content_type}} for 4 weeks
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
        limit=4,
    )
    state["context"] = build_context_from_results(results, max_content_tokens=350)
    return state


async def generate_strategy(state: StrategyState) -> StrategyState:
    llm = get_chat_model("marketing_strategy", temperature=0.3)

    profile_json = json.dumps(compact_profile(state["profile"]), indent=2)
    context = truncate_to_token_budget(state["context"], 1800)

    prompt = STRATEGY_PROMPT.format(
        profile=profile_json,
        context=context,
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
                "Strategy prompt exceeds the model context window. "
                "Set OLLAMA_NUM_CTX=8192 in .env or reduce ingested content, then retry.",
                provider="ollama",
            ) from exc
        if "connection" in message.lower() or "connect" in type(exc).__name__.lower():
            raise LLMServiceError(
                "Cannot reach Ollama during strategy generation. "
                "Run `ollama serve` and verify http://127.0.0.1:11434/api/tags, then retry.",
                provider="ollama",
            ) from exc
        raise LLMServiceError(
            f"Strategy generation failed: {message}",
            provider=settings.resolved_llm_provider(),
        ) from exc

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


async def invoke_marketing_strategy(
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
    profile: dict,
    focus_areas: list[str] | None = None,
) -> dict:
    """Run strategy LangGraph without holding a DB connection (LLM can take many minutes)."""
    graph = build_strategy_graph()
    app = graph.compile()

    return await app.ainvoke({
        "product_id": str(product_id),
        "tenant_id": str(tenant_id),
        "profile": profile,
        "context": "",
        "focus_areas": focus_areas or [],
        "strategy": {},
        "tokens_used": 0,
    })


async def run_marketing_strategy(
    db: AsyncSession,
    product: Product,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    focus_areas: list[str] | None = None,
) -> Artifact:
    result = await invoke_marketing_strategy(
        product.id,
        tenant_id,
        product.profile or {},
        focus_areas,
    )

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
