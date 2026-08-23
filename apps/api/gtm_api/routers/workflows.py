"""Executive brief and async workflow routes."""

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import get_current_user, require_permission
from gtm_api.config import get_settings
from gtm_api.database import get_db
from gtm_api.models import User, WorkflowRun
from gtm_api.schemas import (
    BriefResponse,
    ContentRequest,
    GenerateProposalRequest,
    OutboundSprintRequest,
    QueryRequest,
    StrategyRequest,
    TechnicalEvalRequest,
    WorkerStatusResponse,
    WorkflowRunAccepted,
    WorkflowRunResponse,
    WorkflowStepStatus,
)
from gtm_api.services.brief import build_executive_brief, upsert_dashboard_snapshot
from gtm_api.services.job_queue import get_worker_status
from gtm_api.services.workflows import (
    create_workflow_run,
    get_workflow_run,
    run_build_profile_workflow,
    run_content_workflow,
    run_generate_proposal_workflow,
    run_outbound_sprint_workflow,
    run_query_workflow,
    run_strategy_workflow,
    run_technical_eval_workflow,
)
from gtm_api.tenant import get_product_for_tenant, get_tenant_context

settings = get_settings()
router = APIRouter(tags=["workflows"])


@router.get("/products/{product_id}/brief", response_model=BriefResponse)
async def get_executive_brief(
    product_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tier 0 executive dashboard — SQL aggregates only, no LLM."""
    ctx = await get_tenant_context(user, db)
    product = await get_product_for_tenant(db, product_id, ctx.tenant_id)
    brief = await build_executive_brief(db, ctx.tenant_id, product)
    await upsert_dashboard_snapshot(db, ctx.tenant_id, product_id, brief)
    await db.commit()
    return BriefResponse(product_id=product_id, **{k: v for k, v in brief.items() if k != "product_id"})


@router.post(
    "/products/{product_id}/workflows/outbound_sprint",
    response_model=WorkflowRunAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_outbound_sprint(
    product_id: uuid.UUID,
    req: OutboundSprintRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    input_data = req.model_dump()
    run = await create_workflow_run(
        db,
        ctx.tenant_id,
        product_id,
        "outbound_sprint",
        input_data,
        user.id,
    )
    await db.commit()

    background_tasks.add_task(run_outbound_sprint_workflow, run.id)

    poll_url = f"{settings.api_prefix}/workflows/runs/{run.id}"
    return WorkflowRunAccepted(
        workflow_run_id=run.id,
        status="queued",
        poll_url=poll_url,
    )


@router.post(
    "/products/{product_id}/workflows/technical_eval",
    response_model=WorkflowRunAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_technical_eval(
    product_id: uuid.UUID,
    req: TechnicalEvalRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    input_data = req.model_dump()
    run = await create_workflow_run(
        db,
        ctx.tenant_id,
        product_id,
        "technical_eval",
        input_data,
        user.id,
    )
    await db.commit()

    background_tasks.add_task(run_technical_eval_workflow, run.id)

    poll_url = f"{settings.api_prefix}/workflows/runs/{run.id}"
    return WorkflowRunAccepted(
        workflow_run_id=run.id,
        status="queued",
        poll_url=poll_url,
    )


@router.post(
    "/products/{product_id}/workflows/generate_proposal",
    response_model=WorkflowRunAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_generate_proposal(
    product_id: uuid.UUID,
    req: GenerateProposalRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    input_data = req.model_dump()
    run = await create_workflow_run(
        db,
        ctx.tenant_id,
        product_id,
        "generate_proposal",
        input_data,
        user.id,
    )
    await db.commit()

    background_tasks.add_task(run_generate_proposal_workflow, run.id)

    poll_url = f"{settings.api_prefix}/workflows/runs/{run.id}"
    return WorkflowRunAccepted(
        workflow_run_id=run.id,
        status="queued",
        poll_url=poll_url,
    )


@router.post(
    "/products/{product_id}/workflows/query",
    response_model=WorkflowRunAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_query(
    product_id: uuid.UUID,
    req: QueryRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    input_data = req.model_dump()
    run = await create_workflow_run(
        db,
        ctx.tenant_id,
        product_id,
        "query",
        input_data,
        user.id,
    )
    await db.commit()

    background_tasks.add_task(run_query_workflow, run.id)

    poll_url = f"{settings.api_prefix}/workflows/runs/{run.id}"
    return WorkflowRunAccepted(
        workflow_run_id=run.id,
        status="queued",
        poll_url=poll_url,
    )


@router.post(
    "/products/{product_id}/workflows/build_profile",
    response_model=WorkflowRunAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_build_profile(
    product_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    run = await create_workflow_run(
        db,
        ctx.tenant_id,
        product_id,
        "build_profile",
        {},
        user.id,
    )
    await db.commit()

    background_tasks.add_task(run_build_profile_workflow, run.id)

    poll_url = f"{settings.api_prefix}/workflows/runs/{run.id}"
    return WorkflowRunAccepted(
        workflow_run_id=run.id,
        status="queued",
        poll_url=poll_url,
    )


@router.post(
    "/products/{product_id}/workflows/strategy",
    response_model=WorkflowRunAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_strategy(
    product_id: uuid.UUID,
    req: StrategyRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    input_data = req.model_dump()
    run = await create_workflow_run(
        db,
        ctx.tenant_id,
        product_id,
        "strategy",
        input_data,
        user.id,
    )
    await db.commit()

    background_tasks.add_task(run_strategy_workflow, run.id)

    poll_url = f"{settings.api_prefix}/workflows/runs/{run.id}"
    return WorkflowRunAccepted(
        workflow_run_id=run.id,
        status="queued",
        poll_url=poll_url,
    )


@router.post(
    "/products/{product_id}/workflows/content",
    response_model=WorkflowRunAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_content(
    product_id: uuid.UUID,
    req: ContentRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    input_data = req.model_dump()
    run = await create_workflow_run(
        db,
        ctx.tenant_id,
        product_id,
        "content",
        input_data,
        user.id,
    )
    await db.commit()

    background_tasks.add_task(run_content_workflow, run.id)

    poll_url = f"{settings.api_prefix}/workflows/runs/{run.id}"
    return WorkflowRunAccepted(
        workflow_run_id=run.id,
        status="queued",
        poll_url=poll_url,
    )


@router.get("/workflows/runs/{run_id}", response_model=WorkflowRunResponse)
async def poll_workflow_run(
    run_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    run = await get_workflow_run(db, run_id, ctx.tenant_id)
    if not run:
        raise HTTPException(status_code=404, detail="Workflow run not found")

    steps = [
        WorkflowStepStatus(**step) if isinstance(step, dict) else step
        for step in (run.steps or [])
    ]
    return WorkflowRunResponse(
        id=run.id,
        workflow_name=run.workflow_name,
        status=run.status,
        steps=steps,
        output_data=run.output_data or {},
        error_message=run.error_message,
        started_at=run.started_at,
        completed_at=run.completed_at,
        created_at=run.created_at,
    )


@router.get("/workers/status", response_model=WorkerStatusResponse)
async def worker_status(user: User = Depends(get_current_user)):
    """Live ARQ worker/queue counts for the console rail footer -- tenant-agnostic
    (the worker pool is shared across the whole deployment), any authenticated user
    can see it. `max_jobs=10` mirrors apps/workers/gtm_workers/main.py's
    WorkerSettings.max_jobs -- keep the two in sync if that ever changes."""
    return WorkerStatusResponse(**await get_worker_status(max_jobs=10))


@router.get("/products/{product_id}/workflow-runs", response_model=list[WorkflowRunResponse])
async def list_workflow_runs(
    product_id: uuid.UUID,
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recent/active runs for a product's run-log dock -- newest first."""
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    result = await db.execute(
        select(WorkflowRun)
        .where(WorkflowRun.product_id == product_id, WorkflowRun.tenant_id == ctx.tenant_id)
        .order_by(WorkflowRun.created_at.desc())
        .limit(min(limit, 100))
    )
    runs = result.scalars().all()
    return [
        WorkflowRunResponse(
            id=run.id,
            workflow_name=run.workflow_name,
            status=run.status,
            steps=[
                WorkflowStepStatus(**step) if isinstance(step, dict) else step
                for step in (run.steps or [])
            ],
            output_data=run.output_data or {},
            error_message=run.error_message,
            started_at=run.started_at,
            completed_at=run.completed_at,
            created_at=run.created_at,
        )
        for run in runs
    ]
