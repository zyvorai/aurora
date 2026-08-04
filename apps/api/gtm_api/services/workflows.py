"""Async workflow runner — sequential pipeline for lean hardware."""

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import content_hash
from gtm_api.database import async_session_factory
from gtm_api.models import (
    ApprovalStatus,
    Artifact,
    ArtifactType,
    Campaign,
    Product,
    WorkflowRun,
)
from gtm_api.agents.market_research_agent import invoke_market_research
from gtm_api.agents.outreach import run_outreach
from gtm_api.agents.proposal_generator import invoke_proposal_generator
from gtm_api.agents.product_understanding import run_product_understanding
from gtm_api.agents.solution_architect import invoke_solution_architect
from gtm_api.services.brief import build_executive_brief, upsert_dashboard_snapshot
from gtm_api.services.crm import create_opportunity, opportunity_to_dict, update_opportunity_stage
from gtm_api.services.lead_discovery import discover_leads
from gtm_api.services.lead_qualification import qualify_leads
from gtm_api.tenant import record_usage


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _step(name: str, status: str, error: str | None = None) -> dict:
    step = {"name": name, "status": status, "updated_at": _utcnow().isoformat()}
    if error:
        step["error"] = error
    return step


async def _update_run(
    db: AsyncSession,
    run_id: uuid.UUID,
    *,
    status: str | None = None,
    steps: list | None = None,
    output_data: dict | None = None,
    error_message: str | None = None,
    started: bool = False,
    completed: bool = False,
) -> None:
    run = await db.get(WorkflowRun, run_id)
    if not run:
        return
    if status:
        run.status = status
    if steps is not None:
        run.steps = steps
    if output_data is not None:
        run.output_data = output_data
    if error_message is not None:
        run.error_message = error_message
    if started and not run.started_at:
        run.started_at = _utcnow()
    if completed:
        run.completed_at = _utcnow()
    await db.commit()


async def run_outbound_sprint_workflow(run_id: uuid.UUID) -> None:
    """Sequential: product → market_research → discover → qualify → optional outreach."""
    async with async_session_factory() as db:
        run = await db.get(WorkflowRun, run_id)
        if not run:
            return
        tenant_id = run.tenant_id
        product_id = run.product_id
        user_id = run.created_by
        input_data = dict(run.input_data or {})
        steps: list[dict] = []
        output: dict = {}

        await _update_run(db, run_id, status="running", steps=steps, started=True)

    focus_industries = input_data.get("focus_industries") or input_data.get("focus_areas") or []
    max_leads = int(input_data.get("max_leads") or 50)

    try:
        # Step 1: Product profile
        async with async_session_factory() as db:
            product = await db.get(Product, product_id)
            if not product:
                await _update_run(
                    db, run_id, status="failed",
                    error_message="Product not found",
                    steps=[_step("product", "failed", "Product not found")],
                    completed=True,
                )
                return
            needs_profile = product.profile_status != "ready" or not product.profile

        if needs_profile:
            steps.append(_step("product", "running"))
            async with async_session_factory() as db:
                await _update_run(db, run_id, steps=list(steps))
                product = await db.get(Product, product_id)
                if product:
                    await run_product_understanding(db, product, tenant_id)
                    await db.commit()
            steps[-1] = _step("product", "completed")
        else:
            steps.append(_step("product", "skipped"))

        # Step 2: Market research (LLM)
        steps.append(_step("market_research", "running"))
        async with async_session_factory() as db:
            await _update_run(db, run_id, steps=list(steps))
            product = await db.get(Product, product_id)
            if not product or not product.profile:
                steps[-1] = _step("market_research", "failed", "Profile empty")
                await _update_run(
                    db, run_id, status="failed", steps=list(steps),
                    error_message="Product profile empty", completed=True,
                )
                return
            profile = dict(product.profile)
            product_name = product.name
            pid = product.id

        mr_result = await invoke_market_research(pid, tenant_id, profile, focus_industries)
        brief = mr_result["brief"]
        content = json.dumps(brief, indent=2)

        async with async_session_factory() as db:
            artifact = Artifact(
                product_id=pid,
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
            await record_usage(db, tenant_id, tokens=mr_result.get("tokens_used", 0), agent_runs=1)
            await db.commit()
            await db.refresh(artifact)
            output["market_research_artifact_id"] = str(artifact.id)

        steps[-1] = _step("market_research", "completed")

        # Step 3: Lead discovery (rules — no LLM)
        steps.append(_step("lead_discovery", "running"))
        async with async_session_factory() as db:
            await _update_run(db, run_id, steps=list(steps))
            product = await db.get(Product, product_id)
            if product:
                discovery = await discover_leads(
                    db, product, tenant_id,
                    focus_industries=focus_industries,
                    max_leads=max_leads,
                )
                await db.commit()
                output["discovery"] = discovery

        steps[-1] = _step("lead_discovery", "completed")

        # Step 4: Lead qualification (rules — no LLM)
        steps.append(_step("lead_qualification", "running"))
        async with async_session_factory() as db:
            await _update_run(db, run_id, steps=list(steps))
            product = await db.get(Product, product_id)
            if product:
                qualification = await qualify_leads(
                    db, product, tenant_id,
                    focus_industries=focus_industries,
                )
                await db.commit()
                output["qualification"] = qualification

        steps[-1] = _step("lead_qualification", "completed")

        # Step 5: Campaign template (no LLM)
        campaign_name = input_data.get("campaign_name") or "Outbound Sprint"
        async with async_session_factory() as db:
            product = await db.get(Product, product_id)
            if product and user_id:
                campaign = Campaign(
                    product_id=product_id,
                    tenant_id=tenant_id,
                    name=campaign_name,
                    campaign_type="outreach",
                    status="draft",
                    config={
                        "template": "outbound_sprint",
                        "focus_industries": focus_industries,
                        "max_leads": max_leads,
                    },
                )
                db.add(campaign)
                await db.commit()
                await db.refresh(campaign)
                output["campaign_id"] = str(campaign.id)
        steps.append(_step("campaign", "completed"))

        # Step 6: Optional outreach
        company_url = input_data.get("company_url")
        if company_url and user_id:
            steps.append(_step("outreach", "running"))
            async with async_session_factory() as db:
                await _update_run(db, run_id, steps=list(steps))
                product = await db.get(Product, product_id)
                if product:
                    outreach_artifact = await run_outreach(
                        db, product, tenant_id, user_id,
                        company_url,
                        input_data.get("target_persona", "CTO"),
                        campaign_name,
                    )
                    await db.commit()
                    output["outreach_artifact_id"] = str(outreach_artifact.id)
            steps[-1] = _step("outreach", "completed")
        else:
            steps.append(_step("outreach", "skipped"))

        # Refresh executive brief
        async with async_session_factory() as db:
            product = await db.get(Product, product_id)
            if product:
                brief_snapshot = await build_executive_brief(db, tenant_id, product)
                await upsert_dashboard_snapshot(db, tenant_id, product_id, brief_snapshot)
                output["brief"] = brief_snapshot
                await db.commit()

        async with async_session_factory() as db:
            await _update_run(
                db, run_id, status="completed", steps=steps,
                output_data=output, completed=True,
            )

    except Exception as exc:
        async with async_session_factory() as db:
            if steps and steps[-1]["status"] == "running":
                steps[-1] = _step(steps[-1]["name"], "failed", str(exc))
            await _update_run(
                db, run_id, status="failed", steps=steps,
                error_message=str(exc), completed=True,
            )


async def run_technical_eval_workflow(run_id: uuid.UUID) -> None:
    """Sequential: product → sales_engineer → proposal → crm opportunity."""
    async with async_session_factory() as db:
        run = await db.get(WorkflowRun, run_id)
        if not run:
            return
        tenant_id = run.tenant_id
        product_id = run.product_id
        user_id = run.created_by
        input_data = dict(run.input_data or {})
        steps: list[dict] = []
        output: dict = {}

        await _update_run(db, run_id, status="running", steps=steps, started=True)

    question = input_data.get("question", "")
    scope = input_data.get("scope", "")
    opp_name = input_data.get("opportunity_name", "Technical Eval")
    company = input_data.get("company")
    lead_id = input_data.get("lead_id")
    include_pricing = bool(input_data.get("include_pricing", True))

    try:
        # Step 1: Product profile
        async with async_session_factory() as db:
            product = await db.get(Product, product_id)
            if not product:
                await _update_run(
                    db, run_id, status="failed",
                    error_message="Product not found",
                    steps=[_step("product", "failed", "Product not found")],
                    completed=True,
                )
                return
            needs_profile = product.profile_status != "ready" or not product.profile

        if needs_profile:
            steps.append(_step("product", "running"))
            async with async_session_factory() as db:
                await _update_run(db, run_id, steps=list(steps))
                product = await db.get(Product, product_id)
                if product:
                    await run_product_understanding(db, product, tenant_id)
                    await db.commit()
            steps[-1] = _step("product", "completed")
        else:
            steps.append(_step("product", "skipped"))

        async with async_session_factory() as db:
            product = await db.get(Product, product_id)
            if not product or not product.profile:
                steps.append(_step("sales_engineer", "failed", "Profile empty"))
                await _update_run(
                    db, run_id, status="failed", steps=steps,
                    error_message="Product profile empty", completed=True,
                )
                return
            profile = dict(product.profile)
            product_name = product.name

        # Step 2: Sales engineer (LLM)
        steps.append(_step("sales_engineer", "running"))
        async with async_session_factory() as db:
            await _update_run(db, run_id, steps=list(steps))

        se_result = await invoke_solution_architect(
            product_id, tenant_id, profile, question, input_data.get("context")
        )
        se_tokens = se_result.pop("tokens_used", 0)
        architect_content = json.dumps(se_result, indent=2)

        async with async_session_factory() as db:
            architect_artifact = Artifact(
                product_id=product_id,
                tenant_id=tenant_id,
                artifact_type=ArtifactType.CONTENT,
                title=f"Technical Eval - {company or opp_name}",
                content=architect_content,
                content_hash=content_hash(architect_content),
                status=ApprovalStatus.DRAFT,
                metadata_=se_result,
                created_by=user_id,
            )
            db.add(architect_artifact)
            await record_usage(db, tenant_id, tokens=se_tokens, agent_runs=1)
            await db.commit()
            await db.refresh(architect_artifact)
            architect_artifact_id = architect_artifact.id
            output["architect_artifact_id"] = str(architect_artifact_id)

        steps[-1] = _step("sales_engineer", "completed")

        # Step 3: Proposal (LLM) — scope enriched with architect answer
        steps.append(_step("proposal", "running"))
        async with async_session_factory() as db:
            await _update_run(db, run_id, steps=list(steps))

        enriched_scope = f"{scope}\n\nTechnical context:\n{se_result.get('answer', '')[:2000]}"
        prop_result = await invoke_proposal_generator(
            product_id, tenant_id, profile, enriched_scope, include_pricing
        )
        proposal = prop_result["result"]
        prop_content = json.dumps(proposal, indent=2)

        async with async_session_factory() as db:
            proposal_artifact = Artifact(
                product_id=product_id,
                tenant_id=tenant_id,
                artifact_type=ArtifactType.PROPOSAL,
                title=proposal.get("title", f"Proposal - {company or product_name}"),
                content=prop_content,
                content_hash=content_hash(prop_content),
                status=ApprovalStatus.DRAFT,
                metadata_=proposal,
                created_by=user_id,
            )
            db.add(proposal_artifact)
            await record_usage(db, tenant_id, tokens=prop_result.get("tokens_used", 0), agent_runs=1)
            await db.commit()
            await db.refresh(proposal_artifact)
            proposal_artifact_id = proposal_artifact.id
            output["proposal_artifact_id"] = str(proposal_artifact_id)

        steps[-1] = _step("proposal", "completed")

        # Step 4: CRM opportunity (T0)
        steps.append(_step("crm", "running"))
        async with async_session_factory() as db:
            await _update_run(db, run_id, steps=list(steps))
            parsed_lead = uuid.UUID(lead_id) if lead_id else None
            opp = await create_opportunity(
                db,
                tenant_id,
                product_id,
                name=opp_name,
                company=company,
                stage="proposal",
                lead_id=parsed_lead,
                owner_id=user_id,
                proposal_artifact_id=proposal_artifact_id,
                architect_artifact_id=architect_artifact_id,
                metadata={
                    "question": question,
                    "scope": scope,
                    "workflow": "technical_eval",
                },
            )
            await db.commit()
            await db.refresh(opp)
            output["opportunity"] = opportunity_to_dict(opp)
            output["opportunity_id"] = str(opp.id)

        steps[-1] = _step("crm", "completed")

        async with async_session_factory() as db:
            product = await db.get(Product, product_id)
            if product:
                brief_snapshot = await build_executive_brief(db, tenant_id, product)
                await upsert_dashboard_snapshot(db, tenant_id, product_id, brief_snapshot)
                await db.commit()

        async with async_session_factory() as db:
            await _update_run(
                db, run_id, status="completed", steps=steps,
                output_data=output, completed=True,
            )

    except Exception as exc:
        async with async_session_factory() as db:
            if steps and steps[-1]["status"] == "running":
                steps[-1] = _step(steps[-1]["name"], "failed", str(exc))
            await _update_run(
                db, run_id, status="failed", steps=steps,
                error_message=str(exc), completed=True,
            )


async def run_generate_proposal_workflow(run_id: uuid.UUID) -> None:
    """Async proposal generation — optionally links to an existing opportunity."""
    async with async_session_factory() as db:
        run = await db.get(WorkflowRun, run_id)
        if not run:
            return
        tenant_id = run.tenant_id
        product_id = run.product_id
        user_id = run.created_by
        input_data = dict(run.input_data or {})
        steps: list[dict] = []
        output: dict = {}

        await _update_run(db, run_id, status="running", steps=steps, started=True)

    scope = input_data.get("scope", "")
    include_pricing = bool(input_data.get("include_pricing", True))
    opportunity_id = input_data.get("opportunity_id")

    try:
        async with async_session_factory() as db:
            product = await db.get(Product, product_id)
            if not product or not product.profile:
                await _update_run(
                    db, run_id, status="failed",
                    error_message="Product profile not ready",
                    steps=[_step("proposal", "failed", "Profile not ready")],
                    completed=True,
                )
                return
            profile = dict(product.profile)

        steps.append(_step("proposal", "running"))
        async with async_session_factory() as db:
            await _update_run(db, run_id, steps=list(steps))

        prop_result = await invoke_proposal_generator(
            product_id, tenant_id, profile, scope, include_pricing
        )
        proposal = prop_result["result"]
        prop_content = json.dumps(proposal, indent=2)

        async with async_session_factory() as db:
            proposal_artifact = Artifact(
                product_id=product_id,
                tenant_id=tenant_id,
                artifact_type=ArtifactType.PROPOSAL,
                title=proposal.get("title", "Technical Proposal"),
                content=prop_content,
                content_hash=content_hash(prop_content),
                status=ApprovalStatus.DRAFT,
                metadata_=proposal,
                created_by=user_id,
            )
            db.add(proposal_artifact)
            await record_usage(db, tenant_id, tokens=prop_result.get("tokens_used", 0), agent_runs=1)
            await db.commit()
            await db.refresh(proposal_artifact)
            output["proposal_artifact_id"] = str(proposal_artifact.id)
            output["title"] = proposal.get("title", proposal_artifact.title)

            if opportunity_id:
                from gtm_api.models import Opportunity

                opp = await db.get(Opportunity, uuid.UUID(opportunity_id))
                if opp and opp.tenant_id == tenant_id and opp.product_id == product_id:
                    opp.proposal_artifact_id = proposal_artifact.id
                    if opp.stage in ("discovery", "qualification", "technical_eval"):
                        opp.stage = "proposal"
                        opp.probability = 0.5
                    output["opportunity_id"] = str(opp.id)
                    await db.commit()

        steps[-1] = _step("proposal", "completed")

        async with async_session_factory() as db:
            await _update_run(
                db, run_id, status="completed", steps=steps,
                output_data=output, completed=True,
            )

    except Exception as exc:
        async with async_session_factory() as db:
            if steps and steps[-1]["status"] == "running":
                steps[-1] = _step(steps[-1]["name"], "failed", str(exc))
            await _update_run(
                db, run_id, status="failed", steps=steps,
                error_message=str(exc), completed=True,
            )


WORKFLOW_RUNNERS = {
    "outbound_sprint": run_outbound_sprint_workflow,
    "technical_eval": run_technical_eval_workflow,
    "generate_proposal": run_generate_proposal_workflow,
}


async def create_workflow_run(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
    workflow_name: str,
    input_data: dict,
    user_id: uuid.UUID | None,
) -> WorkflowRun:
    run = WorkflowRun(
        tenant_id=tenant_id,
        product_id=product_id,
        workflow_name=workflow_name,
        status="queued",
        input_data=input_data,
        steps=[],
        created_by=user_id,
    )
    db.add(run)
    await db.flush()
    return run


async def get_workflow_run(
    db: AsyncSession,
    run_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> WorkflowRun | None:
    result = await db.execute(
        select(WorkflowRun).where(
            WorkflowRun.id == run_id,
            WorkflowRun.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()
