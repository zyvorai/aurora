"""Analytics service (Phase 9)."""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import (
    AgentRun,
    Approval,
    Artifact,
    Conversation,
    Lead,
    MetricEvent,
    Product,
)


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
    since = datetime.now(timezone.utc) - timedelta(days=days)
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

    lead_count = await db.execute(
        select(func.count(Lead.id)).where(Lead.tenant_id == tenant_id)
    )
    conversation_count = await db.execute(
        select(func.count(Conversation.id)).where(Conversation.tenant_id == tenant_id)
    )
    artifact_count = await db.execute(
        select(func.count(Artifact.id)).where(Artifact.tenant_id == tenant_id)
    )
    agent_run_count = await db.execute(
        select(func.count(AgentRun.id)).where(AgentRun.tenant_id == tenant_id)
    )

    funnel = {
        "visitors": metrics.get("page_view", 0),
        "content_views": metrics.get("content_view", 0),
        "conversations": conversation_count.scalar() or 0,
        "qualified_leads": lead_count.scalar() or 0,
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
        "metrics": metrics,
        "funnel": funnel,
        "top_questions": [{"question": q} for q in questions if q],
        "knowledge_gaps": [{"query": g} for g in gaps if g],
    }
