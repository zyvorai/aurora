"""Personalized Outreach LangGraph agent (Phase 5)."""

import json
import uuid
from typing import TypedDict
from urllib.parse import urlparse

from langgraph.graph import END, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import content_hash
from gtm_api.config import get_settings
from gtm_api.services.llm import get_chat_model
from gtm_api.models import ApprovalStatus, Artifact, ArtifactType, Campaign, Product
from gtm_api.services.crawler import fetch_single_page
from gtm_api.services.citation_gate import SYSTEM_PROMPT_GROUNDED
from gtm_api.tenant import record_usage

settings = get_settings()

OUTREACH_PROMPT = """Analyze this prospect company and create personalized outreach.

Prospect Company Website Content:
{company_content}

Our Product Profile:
{profile}

Target Persona: {persona}

Return JSON with:
- company_name: detected company name
- company_analysis: {{industry, size_signals, tech_stack, ai_adoption}}
- pain_points: list of likely pain points for this company
- product_fit: why our product fits their needs
- email_draft: personalized email to the {persona} (150-250 words)
- follow_up_sequence: list of 3 {{day, subject, body}} follow-up emails
"""


class OutreachState(TypedDict):
    product_id: str
    tenant_id: str
    profile: dict
    company_url: str
    company_content: str
    target_persona: str
    result: dict
    tokens_used: int


async def research_company(state: OutreachState) -> OutreachState:
    try:
        page = await fetch_single_page(state["company_url"])
        state["company_content"] = f"Title: {page.title}\n\n{page.content[:8000]}"
    except Exception as exc:
        state["company_content"] = f"Could not fetch company website: {exc}"
    return state


async def generate_outreach(state: OutreachState) -> OutreachState:
    llm = get_chat_model("outreach", temperature=0.3)

    prompt = OUTREACH_PROMPT.format(
        company_content=state["company_content"],
        profile=json.dumps(state["profile"], indent=2),
        persona=state["target_persona"],
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
        result = {"email_draft": response.content, "company_name": urlparse(state["company_url"]).netloc}

    state["result"] = result
    state["tokens_used"] = state.get("tokens_used", 0) + 1500
    return state


def build_outreach_graph() -> StateGraph:
    graph = StateGraph(OutreachState)
    graph.add_node("research", research_company)
    graph.add_node("generate", generate_outreach)
    graph.set_entry_point("research")
    graph.add_edge("research", "generate")
    graph.add_edge("generate", END)
    return graph


async def run_outreach(
    db: AsyncSession,
    product: Product,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    company_url: str,
    target_persona: str = "CTO",
    campaign_name: str | None = None,
) -> Artifact:
    graph = build_outreach_graph()
    app = graph.compile()

    result = await app.ainvoke({
        "product_id": str(product.id),
        "tenant_id": str(tenant_id),
        "profile": product.profile or {},
        "company_url": company_url,
        "company_content": "",
        "target_persona": target_persona,
        "result": {},
        "tokens_used": 0,
    })

    outreach = result["result"]
    content = outreach.get("email_draft", "")

    campaign = Campaign(
        product_id=product.id,
        tenant_id=tenant_id,
        name=campaign_name or f"Outreach - {outreach.get('company_name', company_url)}",
        campaign_type="outreach",
        status="draft",
        config={"company_url": company_url, "persona": target_persona},
    )
    db.add(campaign)

    artifact = Artifact(
        product_id=product.id,
        tenant_id=tenant_id,
        artifact_type=ArtifactType.OUTREACH,
        title=f"Outreach - {outreach.get('company_name', target_persona)}",
        content=content,
        content_hash=content_hash(content),
        status=ApprovalStatus.DRAFT,
        channel="email",
        metadata_=outreach,
        created_by=user_id,
    )
    db.add(artifact)
    await record_usage(db, tenant_id, tokens=result.get("tokens_used", 0), agent_runs=1)
    return artifact
