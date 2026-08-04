"""Proposal Generator LangGraph agent (Phase 8)."""

import json
import uuid
from typing import TypedDict

from langgraph.graph import END, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import content_hash
from gtm_api.config import get_settings
from gtm_api.services.llm import get_chat_model
from gtm_api.models import ApprovalStatus, Artifact, ArtifactType, Product
from gtm_api.services.citation_gate import SYSTEM_PROMPT_GROUNDED
from gtm_api.services.chunking import truncate_to_token_budget
from gtm_api.services.mcp import gather_decision_context
from gtm_api.tenant import record_usage

settings = get_settings()

PROPOSAL_PROMPT = """Generate a comprehensive technical proposal.

Context sources used: {sources}

Multi-source platform context:
{docs}

Scope: {scope}
Include Pricing: {include_pricing}

Return JSON with:
- title: proposal title
- proposal_content: full proposal (executive summary, solution overview, technical approach)
- sow: statement of work with deliverables and milestones
- roi_analysis: ROI analysis with estimated benefits
- pricing: pricing section (if requested, based on product profile only)
- timeline: implementation timeline
"""


class ProposalState(TypedDict):
    product_id: str
    tenant_id: str
    profile: dict
    docs_context: str
    sources_used: list[str]
    scope: str
    include_pricing: bool
    result: dict
    tokens_used: int


async def retrieve_proposal_context(state: ProposalState) -> ProposalState:
    if state.get("docs_context"):
        return state

    decision_ctx = await gather_decision_context(
        state["scope"],
        uuid.UUID(state["tenant_id"]),
        uuid.UUID(state["product_id"]),
        profile=state.get("profile"),
    )
    state["docs_context"] = decision_ctx.to_prompt_section(max_chars=10000)
    state["sources_used"] = decision_ctx.sources_used
    state["_search_results"] = decision_ctx.search_results  # type: ignore
    return state


async def generate_proposal(state: ProposalState) -> ProposalState:
    llm = get_chat_model("proposal_generator", temperature=0.2)

    prompt = PROPOSAL_PROMPT.format(
        sources=", ".join(state.get("sources_used", [])),
        docs=truncate_to_token_budget(state["docs_context"], 8000),
        scope=state["scope"],
        include_pricing=state["include_pricing"],
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
        result = {"title": "Proposal", "proposal_content": response.content}

    state["result"] = result
    state["tokens_used"] = state.get("tokens_used", 0) + 3000
    return state


def build_proposal_graph() -> StateGraph:
    graph = StateGraph(ProposalState)
    graph.add_node("retrieve", retrieve_proposal_context)
    graph.add_node("generate", generate_proposal)
    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", END)
    return graph


async def invoke_proposal_generator(
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
    profile: dict,
    scope: str,
    include_pricing: bool = True,
    *,
    db: AsyncSession | None = None,
    product: Product | None = None,
) -> dict:
    """Run proposal LangGraph without holding a DB connection."""
    graph = build_proposal_graph()
    app = graph.compile()

    decision_ctx = await gather_decision_context(
        scope,
        tenant_id,
        product_id,
        db=db,
        product=product,
        profile=profile,
    )

    return await app.ainvoke({
        "product_id": str(product_id),
        "tenant_id": str(tenant_id),
        "profile": profile,
        "docs_context": decision_ctx.to_prompt_section(max_chars=10000),
        "sources_used": decision_ctx.sources_used,
        "scope": scope,
        "include_pricing": include_pricing,
        "result": {},
        "tokens_used": 0,
        "_search_results": decision_ctx.search_results,
    })


async def run_proposal_generator(
    db: AsyncSession,
    product: Product,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    scope: str,
    include_pricing: bool = True,
) -> Artifact:
    result = await invoke_proposal_generator(
        product.id,
        tenant_id,
        product.profile or {},
        scope,
        include_pricing,
        db=db,
        product=product,
    )
    proposal = result["result"]
    sources_used = result.get("sources_used", [])
    full_content = json.dumps(proposal, indent=2)

    artifact = Artifact(
        product_id=product.id,
        tenant_id=tenant_id,
        artifact_type=ArtifactType.PROPOSAL,
        title=proposal.get("title", "Technical Proposal"),
        content=full_content,
        content_hash=content_hash(full_content),
        status=ApprovalStatus.DRAFT,
        metadata_={**proposal, "sources_used": sources_used},
        created_by=user_id,
    )
    db.add(artifact)
    await record_usage(db, tenant_id, tokens=result.get("tokens_used", 0), agent_runs=1)
    return artifact
