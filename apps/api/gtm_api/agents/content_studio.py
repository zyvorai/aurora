"""Content Studio LangGraph agent (Phase 3)."""

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
from gtm_api.services.vector_store import SearchResult, vector_store
from gtm_api.tenant import record_usage

settings = get_settings()

CONTENT_TEMPLATES = {
    "linkedin": "Write a LinkedIn post (150-300 words) about: {topic}. Tone: {tone}. Target: {persona}.",
    "blog": "Write a technical blog article (800-1200 words) about: {topic}. Tone: {tone}.",
    "email": "Write a marketing email about: {topic}. Tone: {tone}. Target: {persona}.",
    "x_thread": "Write an X/Twitter thread (5-7 tweets) about: {topic}. Tone: {tone}.",
    "case_study": "Write a case study about: {topic}. Include problem, solution, results.",
    "whitepaper": "Write a whitepaper executive summary about: {topic}.",
    "technical_deep_dive": "Write a technical deep dive article about: {topic}.",
}


class ContentState(TypedDict):
    product_id: str
    tenant_id: str
    profile: dict
    context: str
    content_type: str
    topic: str
    tone: str
    target_persona: str
    title: str
    content: str
    citations: list
    grounded: bool
    tokens_used: int


async def retrieve_content_context(state: ContentState) -> ContentState:
    vector = await embedding_service.embed_query(state["topic"])
    results = await vector_store.search(
        uuid.UUID(state["tenant_id"]),
        uuid.UUID(state["product_id"]),
        vector,
        limit=6,
    )
    state["context"] = build_context_from_results(results)
    state["_search_results"] = results  # type: ignore
    return state


async def generate_content(state: ContentState) -> ContentState:
    llm = get_chat_model("content_studio", temperature=0.4)

    template = CONTENT_TEMPLATES.get(
        state["content_type"],
        "Write content about: {topic}. Tone: {tone}.",
    )
    prompt = template.format(
        topic=state["topic"],
        tone=state["tone"],
        persona=state.get("target_persona", "technical decision maker"),
    )

    response = await llm.ainvoke([
        {"role": "system", "content": SYSTEM_PROMPT_GROUNDED + f"\n\nProduct Profile:\n{json.dumps(state['profile'], indent=2)}"},
        {"role": "user", "content": f"{prompt}\n\nSources:\n{state['context']}"},
    ])

    content = response.content
    lines = content.strip().split("\n")
    title = lines[0].strip("# ").strip() if lines else state["topic"]
    state["title"] = title
    state["content"] = content

    search_results: list[SearchResult] = state.get("_search_results", [])  # type: ignore
    grounding = verify_grounding(content, search_results)
    state["grounded"] = grounding.grounded
    state["citations"] = [
        {"chunk_id": c.chunk_id, "document_title": c.document_title, "excerpt": c.excerpt, "url": c.url}
        for c in grounding.citations
    ]
    state["tokens_used"] = state.get("tokens_used", 0) + 1500
    return state


def build_content_graph() -> StateGraph:
    graph = StateGraph(ContentState)
    graph.add_node("retrieve", retrieve_content_context)
    graph.add_node("generate", generate_content)
    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", END)
    return graph


async def run_content_generation(
    db: AsyncSession,
    product: Product,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    content_type: str,
    topic: str,
    tone: str = "professional",
    target_persona: str | None = None,
) -> Artifact:
    graph = build_content_graph()
    app = graph.compile()

    result = await app.ainvoke({
        "product_id": str(product.id),
        "tenant_id": str(tenant_id),
        "profile": product.profile or {},
        "context": "",
        "content_type": content_type,
        "topic": topic,
        "tone": tone,
        "target_persona": target_persona or "CTO",
        "title": "",
        "content": "",
        "citations": [],
        "grounded": False,
        "tokens_used": 0,
    })

    artifact = Artifact(
        product_id=product.id,
        tenant_id=tenant_id,
        artifact_type=ArtifactType.CONTENT,
        title=result["title"],
        content=result["content"],
        content_hash=content_hash(result["content"]),
        status=ApprovalStatus.DRAFT,
        channel=content_type,
        citations=result["citations"],
        metadata_={"grounded": result["grounded"], "tone": tone, "topic": topic},
        created_by=user_id,
    )
    db.add(artifact)
    await record_usage(db, tenant_id, tokens=result.get("tokens_used", 0), agent_runs=1)
    return artifact
