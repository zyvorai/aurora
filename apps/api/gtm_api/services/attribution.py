"""Campaign touchpoint attribution — first/last touch from MetricEvent."""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import MetricEvent
from gtm_api.services.analytics import emit_event

TOUCH_EVENT_TYPES = frozenset({
    "touchpoint",
    "inbound_form",
    "outreach_sent",
    "page_view",
    "content_view",
})


async def record_touchpoint(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
    *,
    touch_type: str = "touchpoint",
    channel: str | None = None,
    campaign: str | None = None,
    source: str | None = None,
    lead_id: str | None = None,
    email: str | None = None,
    extra: dict | None = None,
) -> None:
    await emit_event(
        db,
        tenant_id,
        touch_type,
        product_id=product_id,
        event_data={
            "channel": channel,
            "campaign": campaign,
            "source": source,
            "lead_id": lead_id,
            "email": email,
            **(extra or {}),
        },
    )


async def get_attribution_summary(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
    *,
    days: int = 30,
) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(MetricEvent)
        .where(
            MetricEvent.tenant_id == tenant_id,
            MetricEvent.product_id == product_id,
            MetricEvent.created_at >= since,
            MetricEvent.event_type.in_(tuple(TOUCH_EVENT_TYPES)),
        )
        .order_by(MetricEvent.created_at.asc())
    )
    events = list(result.scalars().all())

    by_channel: dict[str, int] = defaultdict(int)
    by_campaign: dict[str, int] = defaultdict(int)
    by_source: dict[str, int] = defaultdict(int)
    first_touch: dict[str, dict] = {}
    last_touch: dict[str, dict] = {}

    for ev in events:
        data = ev.event_data or {}
        channel = data.get("channel") or "unknown"
        campaign = data.get("campaign") or "none"
        source = data.get("source") or "direct"
        by_channel[channel] += 1
        by_campaign[campaign] += 1
        by_source[source] += 1

        key = data.get("lead_id") or data.get("email") or str(ev.id)
        touch = {
            "type": ev.event_type,
            "channel": channel,
            "campaign": campaign,
            "source": source,
            "at": ev.created_at.isoformat() if ev.created_at else None,
        }
        if key not in first_touch:
            first_touch[key] = touch
        last_touch[key] = touch

    return {
        "period_days": days,
        "total_touchpoints": len(events),
        "by_channel": dict(by_channel),
        "by_campaign": dict(by_campaign),
        "by_source": dict(by_source),
        "unique_leads": len(first_touch),
        "first_touch_sample": list(first_touch.values())[:10],
        "last_touch_sample": list(last_touch.values())[:10],
    }
