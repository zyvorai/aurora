"""Analytics service (Phase 9)."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import (
    AgentRun,
    Artifact,
    Conversation,
    Lead,
    MetricEvent,
)

# Lead.stage value set by lead qualification, inbound routing and the sales agent.
QUALIFIED_STAGE = "qualified"

FUNNEL_DEFINITIONS = {
    "visitors": "page_view events in the window",
    "content_views": "content_view events in the window",
    "conversations": "Conversations started in the window",
    "leads_total": "Leads created in the window, any stage",
    "qualified_leads": "Leads created in the window whose stage is 'qualified'",
    "artifacts_created": "Artifacts (drafts, proposals, content) created in the window",
    "agent_runs": "Agent runs started in the window",
    "_scope": "Counts are limited to the selected product when one is given, else the whole tenant",
}


async def emit_event(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    event_type: str,
    product_id: uuid.UUID | None = None,
    event_data: dict | None = None,
) -> None:
    event = MetricEvent(
        tenant_id=tenant_id,
        product_id=product_id,
        event_type=event_type,
        event_data=event_data or {},
    )
    db.add(event)


async def get_analytics(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID | None = None,
    days: int = 30,
) -> dict:
    since = datetime.now(UTC) - timedelta(days=days)
    period = since.strftime("%Y-%m")

    base_filter = [MetricEvent.tenant_id == tenant_id, MetricEvent.created_at >= since]
    if product_id:
        base_filter.append(MetricEvent.product_id == product_id)

    event_counts = await db.execute(
        select(MetricEvent.event_type, func.count(MetricEvent.id))
        .where(*base_filter)
        .group_by(MetricEvent.event_type)
    )
    metrics = {row[0]: row[1] for row in event_counts.all()}

    def _scoped(model, created_col, *extra):
        """Count rows for this tenant, in the reporting window, for the selected product."""
        conds = [model.tenant_id == tenant_id, created_col >= since, *extra]
        if product_id:
            conds.append(model.product_id == product_id)
        return select(func.count(model.id)).where(*conds)

    leads_total = await db.execute(_scoped(Lead, Lead.created_at))
    qualified = await db.execute(
        _scoped(Lead, Lead.created_at, Lead.stage == QUALIFIED_STAGE)
    )
    conversation_count = await db.execute(_scoped(Conversation, Conversation.created_at))
    artifact_count = await db.execute(_scoped(Artifact, Artifact.created_at))
    agent_run_count = await db.execute(_scoped(AgentRun, AgentRun.started_at))

    funnel = {
        "visitors": metrics.get("page_view", 0),
        "content_views": metrics.get("content_view", 0),
        "conversations": conversation_count.scalar() or 0,
        "leads_total": leads_total.scalar() or 0,
        "qualified_leads": qualified.scalar() or 0,
        "artifacts_created": artifact_count.scalar() or 0,
        "agent_runs": agent_run_count.scalar() or 0,
    }

    top_questions = await db.execute(
        select(MetricEvent.event_data)
        .where(
            MetricEvent.tenant_id == tenant_id,
            MetricEvent.event_type == "query",
            MetricEvent.created_at >= since,
        )
        .limit(10)
    )
    questions = [row[0].get("question", "") for row in top_questions.all() if row[0]]

    knowledge_gaps = await db.execute(
        select(MetricEvent.event_data)
        .where(
            MetricEvent.tenant_id == tenant_id,
            MetricEvent.event_type == "ungrounded_blocked",
            MetricEvent.created_at >= since,
        )
        .limit(10)
    )
    gaps = [row[0].get("query", "") for row in knowledge_gaps.all() if row[0]]

    return {
        "period": period,
        "window": {"days": days, "since": since.isoformat(), "product_id": str(product_id) if product_id else None},
        "metrics": metrics,
        "funnel": funnel,
        "definitions": FUNNEL_DEFINITIONS,
        "top_questions": [{"question": q} for q in questions if q],
        "knowledge_gaps": [{"query": g} for g in gaps if g],
    }
