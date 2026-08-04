"""Dispatch supervisor requests to registered agent implementations."""

from __future__ import annotations

import json
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.agents.base import AgentInput, AgentOutput, wrap_llm_error
from gtm_api.agents.marketing_strategy import invoke_marketing_strategy
from gtm_api.agents.market_research_agent import invoke_market_research
from gtm_api.agents.product_understanding import run_product_understanding
from gtm_api.agents.proposal_generator import run_proposal_generator
from gtm_api.agents.outreach import run_outreach
from gtm_api.agents.content_studio import run_content_generation
from gtm_api.agents.sales_agent import run_sales_chat
from gtm_api.agents.solution_architect import invoke_solution_architect
from gtm_api.agents.registry import get_agent_spec, resolve_agent_for_request
from gtm_api.auth import content_hash
from gtm_api.database import async_session_factory
from gtm_api.models import ApprovalStatus, Artifact, ArtifactType, Product
from gtm_api.services.analytics import get_analytics
from gtm_api.services.citation_gate import (
    SYSTEM_PROMPT_GROUNDED,
    verify_grounding,
)
from gtm_api.services.mcp import gather_decision_context
from gtm_api.services.ingestion import ingest_all_sources
from gtm_api.services.lead_discovery import discover_leads
from gtm_api.services.lead_qualification import qualify_leads
from gtm_api.services.crm import (
    create_opportunity,
    get_opportunity,
    list_opportunities,
    opportunity_to_dict,
    pipeline_summary,
    update_opportunity_stage,
)
from gtm_api.services.customer_success import (
    account_health_to_dict,
    build_success_plan,
    list_account_health,
    refresh_cs_briefs_for_product,
)
from gtm_api.services.learning import refresh_product
from gtm_api.services.llm import get_chat_model
from gtm_api.tenant import record_usage


async def dispatch_agent(
    db: AsyncSession,
    product: Product,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    request_type: str,
    input_data: dict,
) -> AgentOutput:
    spec = resolve_agent_for_request(request_type)
    if not spec:
        return AgentOutput(
            agent_id="unknown",
            status="failed",
            error=f"Unknown request type: {request_type}",
        )
    if not spec.implemented:
        return AgentOutput(
            agent_id=spec.agent_id,
            status="not_implemented",
            error=f"{spec.display_name} is not built yet",
            next_suggested_agents=_suggest_next(spec.agent_id),
        )

    agent_input = AgentInput(
        tenant_id=tenant_id,
        product_id=product.id,
        user_id=user_id,
        request_type=request_type,
        payload=input_data,
    )

    handlers = {
        "product": _execute_product,
        "market_research": _execute_market_research,
        "lead_discovery": _execute_lead_discovery,
        "lead_qualification": _execute_lead_qualification,
        "outreach": _execute_outreach,
        "campaign": _execute_campaign,
        "sales_engineer": _execute_sales_engineer,
        "proposal": _execute_proposal,
        "analytics": _execute_analytics,
        "crm": _execute_crm,
        "customer_success": _execute_customer_success,
    }
    handler = handlers.get(spec.agent_id)
    if not handler:
        return AgentOutput(
            agent_id=spec.agent_id,
            status="not_implemented",
            error=f"No handler for {spec.agent_id}",
        )

    try:
        return await handler(db, product, agent_input)
    except Exception as exc:
        return wrap_llm_error(spec.agent_id, exc)


def _suggest_next(agent_id: str) -> list[str]:
    suggestions = {
        "lead_discovery": ["market_research", "lead_qualification"],
        "crm": ["lead_qualification", "proposal"],
        "customer_success": ["crm", "analytics"],
    }
    return suggestions.get(agent_id, [])


async def _execute_product(
    db: AsyncSession,
    product: Product,
    agent_input: AgentInput,
) -> AgentOutput:
    request_type = agent_input.request_type
    if request_type == "ingest":
        source_ids = agent_input.payload.get("source_ids")
        result = await ingest_all_sources(
            db, product.id, agent_input.tenant_id, source_ids
        )
        return AgentOutput(
            agent_id="product",
            status="completed",
            artifacts={"ingest": result},
            next_suggested_agents=["product"],
        )

    if request_type == "understand":
        profile = await run_product_understanding(db, product, agent_input.tenant_id)
        return AgentOutput(
            agent_id="product",
            status="completed",
            artifacts={"profile": profile, "profile_status": "ready"},
            next_suggested_agents=["market_research"],
        )

    if request_type == "refresh":
        result = await refresh_product(db, product.id, agent_input.tenant_id)
        return AgentOutput(
            agent_id="product",
            status="completed",
            artifacts={"refresh": result},
        )

    return AgentOutput(
        agent_id="product",
        status="failed",
        error=f"Unsupported product request: {request_type}",
    )


async def _execute_market_research(
    db: AsyncSession,
    product: Product,
    agent_input: AgentInput,
) -> AgentOutput:
    if not product.profile:
        return AgentOutput(
            agent_id="market_research",
            status="needs_input",
            error="Product profile is empty. Run ingest and understand first.",
            next_suggested_agents=["product"],
        )

    profile = dict(product.profile)
    tenant_id = agent_input.tenant_id
    user_id = agent_input.user_id
    product_id = product.id
    product_name = product.name
    focus_areas = agent_input.payload.get("focus_areas") or agent_input.payload.get("focus_industries") or []
    request_type = agent_input.request_type

    if request_type == "market_research":
        result = await invoke_market_research(product_id, tenant_id, profile, focus_areas)
        brief = result["brief"]
        content = json.dumps(brief, indent=2)
        artifact = Artifact(
            product_id=product_id,
            tenant_id=tenant_id,
            artifact_type=ArtifactType.MARKET_RESEARCH,
            title=f"Market Research - {product_name}",
            content=content,
            content_hash=content_hash(content),
            status=ApprovalStatus.DRAFT,
            metadata_=brief,
            created_by=user_id,
        )
        db.add(artifact)
        await record_usage(db, tenant_id, tokens=result.get("tokens_used", 0), agent_runs=1)
        await db.flush()
        await db.refresh(artifact)
        return AgentOutput(
            agent_id="market_research",
            status="completed",
            artifacts={"artifact_id": str(artifact.id), "brief": brief},
            tokens_used=result.get("tokens_used", 0),
            next_suggested_agents=["lead_discovery"],
        )

    result = await invoke_marketing_strategy(product_id, tenant_id, profile, focus_areas)
    strategy = result["strategy"]
    content = json.dumps(strategy, indent=2)

    artifact = Artifact(
        product_id=product_id,
        tenant_id=tenant_id,
        artifact_type=ArtifactType.STRATEGY,
        title=f"GTM Strategy - {product_name}",
        content=content,
        content_hash=content_hash(content),
        status=ApprovalStatus.DRAFT,
        metadata_=strategy,
        created_by=user_id,
    )
    db.add(artifact)
    await record_usage(db, tenant_id, tokens=result.get("tokens_used", 0), agent_runs=1)
    await db.flush()
    await db.refresh(artifact)

    return AgentOutput(
        agent_id="market_research",
        status="completed",
        artifacts={
            "artifact_id": str(artifact.id),
            "strategy": strategy,
            "sources_used": result.get("sources_used", []),
        },
        tokens_used=result.get("tokens_used", 0),
        next_suggested_agents=["lead_discovery", "campaign", "outreach"],
    )


async def _execute_lead_discovery(
    db: AsyncSession,
    product: Product,
    agent_input: AgentInput,
) -> AgentOutput:
    payload = agent_input.payload
    result = await discover_leads(
        db,
        product,
        agent_input.tenant_id,
        focus_industries=payload.get("focus_industries") or payload.get("focus_areas"),
        max_leads=payload.get("max_leads", 50),
        csv_import=payload.get("csv_import"),
        geo=payload.get("geo"),
    )
    return AgentOutput(
        agent_id="lead_discovery",
        status="completed",
        artifacts=result,
        next_suggested_agents=["lead_qualification"],
    )


async def _execute_lead_qualification(
    db: AsyncSession,
    product: Product,
    agent_input: AgentInput,
) -> AgentOutput:
    request_type = agent_input.request_type
    payload = agent_input.payload

    if request_type == "qualify_leads":
        result = await qualify_leads(
            db,
            product,
            agent_input.tenant_id,
            account_ids=payload.get("account_ids"),
            focus_industries=payload.get("focus_industries"),
        )
        return AgentOutput(
            agent_id="lead_qualification",
            status="completed",
            artifacts=result,
            next_suggested_agents=["outreach"],
        )

    if request_type == "chat":
        message = payload.get("message", "")
        session_id = payload.get("session_id") or str(uuid.uuid4())
        result = await run_sales_chat(
            db, product, agent_input.tenant_id, message, session_id
        )
        return AgentOutput(
            agent_id="lead_qualification",
            status="completed",
            artifacts=result,
            tokens_used=result.get("tokens_used", 0),
            next_suggested_agents=["outreach", "proposal"],
        )

    if request_type == "query":
        question = payload.get("question", "")
        if not question:
            return AgentOutput(
                agent_id="lead_qualification",
                status="needs_input",
                error="question is required",
            )
        decision_ctx = await gather_decision_context(
            question,
            agent_input.tenant_id,
            product.id,
            db=db,
            product=product,
            profile=product.profile,
        )
        context = decision_ctx.to_prompt_section()
        results = decision_ctx.search_results
        llm = get_chat_model("sales_agent", temperature=0.1)
        response = await llm.ainvoke([
            {"role": "system", "content": SYSTEM_PROMPT_GROUNDED},
            {
                "role": "user",
                "content": (
                    f"Question: {question}\n\n"
                    f"Multi-source context (sources: {', '.join(decision_ctx.sources_used)}):\n{context}"
                ),
            },
        ])
        answer = response.content
        grounding = verify_grounding(answer, results)
        return AgentOutput(
            agent_id="lead_qualification",
            status="completed",
            artifacts={
                "answer": answer,
                "grounded": grounding.grounded,
                "confidence": grounding.confidence,
                "sources_used": decision_ctx.sources_used,
            },
            citations=[c.model_dump() for c in grounding.citations],
        )

    return AgentOutput(
        agent_id="lead_qualification",
        status="failed",
        error=f"Unsupported sales request: {request_type}",
    )


async def _execute_outreach(
    db: AsyncSession,
    product: Product,
    agent_input: AgentInput,
) -> AgentOutput:
    company_url = agent_input.payload.get("company_url", "")
    if not company_url:
        return AgentOutput(
            agent_id="outreach",
            status="needs_input",
            error="company_url is required",
        )
    artifact = await run_outreach(
        db,
        product,
        agent_input.tenant_id,
        agent_input.user_id,
        company_url,
        agent_input.payload.get("target_persona", "CTO"),
        agent_input.payload.get("campaign_name"),
    )
    meta = artifact.metadata_ or {}
    return AgentOutput(
        agent_id="outreach",
        status="completed",
        artifacts={
            "artifact_id": str(artifact.id),
            "company_name": meta.get("company_name", ""),
            "email_draft": meta.get("email_draft", artifact.content),
            "follow_up_sequence": meta.get("follow_up_sequence", []),
        },
    )


async def _execute_campaign(
    db: AsyncSession,
    product: Product,
    agent_input: AgentInput,
) -> AgentOutput:
    topic = agent_input.payload.get("topic", "")
    content_type = agent_input.payload.get("content_type", "linkedin")
    if not topic:
        return AgentOutput(
            agent_id="campaign",
            status="needs_input",
            error="topic is required",
        )
    artifact = await run_content_generation(
        db,
        product,
        agent_input.tenant_id,
        agent_input.user_id,
        content_type,
        topic,
        agent_input.payload.get("tone", "professional"),
        agent_input.payload.get("target_persona"),
    )
    return AgentOutput(
        agent_id="campaign",
        status="completed",
        artifacts={
            "artifact_id": str(artifact.id),
            "title": artifact.title,
            "content": artifact.content,
            "channel": artifact.channel,
        },
    )


async def _execute_sales_engineer(
    db: AsyncSession,
    product: Product,
    agent_input: AgentInput,
) -> AgentOutput:
    question = agent_input.payload.get("question", "")
    if not question:
        return AgentOutput(
            agent_id="sales_engineer",
            status="needs_input",
            error="question is required",
        )

    profile = dict(product.profile or {})
    tenant_id = agent_input.tenant_id
    product_id = product.id

    result = await invoke_solution_architect(
        product_id,
        tenant_id,
        profile,
        question,
        agent_input.payload.get("context"),
    )
    tokens_used = result.pop("tokens_used", 0)
    result.pop("security_notes", None)

    async with async_session_factory() as usage_db:
        await record_usage(usage_db, tenant_id, tokens=tokens_used, agent_runs=1)
        await usage_db.commit()

    return AgentOutput(
        agent_id="sales_engineer",
        status="completed",
        artifacts=result,
        tokens_used=tokens_used,
        next_suggested_agents=["proposal"],
    )


async def _execute_proposal(
    db: AsyncSession,
    product: Product,
    agent_input: AgentInput,
) -> AgentOutput:
    scope = agent_input.payload.get("scope", "")
    if not scope:
        return AgentOutput(
            agent_id="proposal",
            status="needs_input",
            error="scope is required",
        )
    artifact = await run_proposal_generator(
        db,
        product,
        agent_input.tenant_id,
        agent_input.user_id,
        scope,
        agent_input.payload.get("include_pricing", True),
    )
    meta = artifact.metadata_ or {}
    return AgentOutput(
        agent_id="proposal",
        status="completed",
        artifacts={
            "artifact_id": str(artifact.id),
            "title": meta.get("title", artifact.title),
            "proposal_content": meta.get("proposal_content", ""),
            "sources_used": meta.get("sources_used", []),
        },
    )


async def _execute_analytics(
    db: AsyncSession,
    product: Product,
    agent_input: AgentInput,
) -> AgentOutput:
    data = await get_analytics(db, agent_input.tenant_id, product.id)
    return AgentOutput(
        agent_id="analytics",
        status="completed",
        artifacts=data,
    )


async def _execute_crm(
    db: AsyncSession,
    product: Product,
    agent_input: AgentInput,
) -> AgentOutput:
    request_type = agent_input.request_type
    payload = agent_input.payload
    tenant_id = agent_input.tenant_id

    if request_type in ("crm", "create_opportunity"):
        name = payload.get("name", "")
        if not name:
            return AgentOutput(
                agent_id="crm",
                status="needs_input",
                error="name is required",
            )
        lead_id = payload.get("lead_id")
        parsed_lead = uuid.UUID(lead_id) if isinstance(lead_id, str) else lead_id
        opp = await create_opportunity(
            db,
            tenant_id,
            product.id,
            name=name,
            company=payload.get("company"),
            stage=payload.get("stage", "discovery"),
            lead_id=parsed_lead,
            owner_id=agent_input.user_id,
            amount=payload.get("amount"),
            metadata=payload.get("metadata"),
        )
        await db.flush()
        return AgentOutput(
            agent_id="crm",
            status="completed",
            artifacts={"opportunity": opportunity_to_dict(opp)},
            next_suggested_agents=["sales_engineer", "proposal"],
        )

    if request_type == "update_stage":
        opp_id = payload.get("opportunity_id")
        stage = payload.get("stage")
        if not opp_id or not stage:
            return AgentOutput(
                agent_id="crm",
                status="needs_input",
                error="opportunity_id and stage are required",
            )
        try:
            opp = await update_opportunity_stage(
                db,
                uuid.UUID(opp_id) if isinstance(opp_id, str) else opp_id,
                tenant_id,
                stage,
                user_id=agent_input.user_id,
            )
        except ValueError as exc:
            return AgentOutput(agent_id="crm", status="failed", error=str(exc))
        if not opp:
            return AgentOutput(agent_id="crm", status="failed", error="Opportunity not found")
        return AgentOutput(
            agent_id="crm",
            status="completed",
            artifacts={"opportunity": opportunity_to_dict(opp)},
        )

    if request_type == "pipeline_summary":
        summary = await pipeline_summary(db, product.id, tenant_id)
        opps = await list_opportunities(db, product.id, tenant_id, limit=50)
        return AgentOutput(
            agent_id="crm",
            status="completed",
            artifacts={
                "summary": summary,
                "opportunities": [opportunity_to_dict(o) for o in opps],
            },
        )

    opp_id = payload.get("opportunity_id")
    if opp_id:
        opp = await get_opportunity(
            db,
            uuid.UUID(opp_id) if isinstance(opp_id, str) else opp_id,
            tenant_id,
        )
        if opp:
            return AgentOutput(
                agent_id="crm",
                status="completed",
                artifacts={"opportunity": opportunity_to_dict(opp)},
            )
        return AgentOutput(agent_id="crm", status="failed", error="Opportunity not found")

    opps = await list_opportunities(db, product.id, tenant_id, stage=payload.get("stage"))
    return AgentOutput(
        agent_id="crm",
        status="completed",
        artifacts={"opportunities": [opportunity_to_dict(o) for o in opps]},
    )


async def _execute_customer_success(
    db: AsyncSession,
    product: Product,
    agent_input: AgentInput,
) -> AgentOutput:
    request_type = agent_input.request_type
    payload = agent_input.payload
    tenant_id = agent_input.tenant_id

    if request_type in ("success_plan", "cs_brief"):
        opp_id = payload.get("opportunity_id")
        if not opp_id:
            return AgentOutput(
                agent_id="customer_success",
                status="needs_input",
                error="opportunity_id is required",
            )
        opp = await get_opportunity(
            db,
            uuid.UUID(opp_id) if isinstance(opp_id, str) else opp_id,
            tenant_id,
        )
        if not opp:
            return AgentOutput(agent_id="customer_success", status="failed", error="Opportunity not found")
        plan = await build_success_plan(db, tenant_id, product.id, opp)
        return AgentOutput(
            agent_id="customer_success",
            status="completed",
            artifacts=plan,
            next_suggested_agents=["analytics"],
        )

    if request_type == "account_health":
        records = await list_account_health(db, product.id, tenant_id)
        return AgentOutput(
            agent_id="customer_success",
            status="completed",
            artifacts={"accounts": [account_health_to_dict(r) for r in records]},
        )

    if payload.get("refresh_all"):
        result = await refresh_cs_briefs_for_product(db, product.id, tenant_id)
        return AgentOutput(
            agent_id="customer_success",
            status="completed",
            artifacts=result,
        )

    return AgentOutput(
        agent_id="customer_success",
        status="failed",
        error=f"Unsupported CS request: {request_type}",
    )
