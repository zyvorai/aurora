"""Campaign monitor — background status checks (T0)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import Artifact, ArtifactType, Campaign, MetricEvent


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def get_campaign_status(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> dict | None:
    campaign = await db.get(Campaign, campaign_id)
    if not campaign or campaign.tenant_id != tenant_id:
        return None

    config = dict(campaign.config or {})
    channels = config.get("channels") or ["email"]
    focus = config.get("focus_industries") or []

    outreach_count = await db.execute(
        select(func.count(Artifact.id)).where(
            Artifact.tenant_id == tenant_id,
            Artifact.product_id == campaign.product_id,
            Artifact.artifact_type == ArtifactType.OUTREACH,
        )
    )
    event_count = await db.execute(
        select(func.count(MetricEvent.id)).where(
            MetricEvent.tenant_id == tenant_id,
            MetricEvent.product_id == campaign.product_id,
            MetricEvent.event_type.in_(("outreach_sent", "email_open", "content_view")),
        )
    )

    targets = config.get("kpi_targets") or {"outreach": 10, "responses": 3}
    outreach_actual = outreach_count.scalar() or 0
    engagement_actual = event_count.scalar() or 0

    progress = {
        "outreach": {"target": targets.get("outreach", 10), "actual": outreach_actual},
        "engagement": {"target": targets.get("responses", 3), "actual": engagement_actual},
    }
    on_track = outreach_actual >= targets.get("outreach", 10) * 0.5

    monitor_status = campaign.status
    if campaign.status == "draft" and config.get("auto_activate"):
        monitor_status = "active"
    elif not on_track and campaign.status == "active":
        monitor_status = "needs_attention"

    return {
        "campaign_id": str(campaign.id),
        "name": campaign.name,
        "status": monitor_status,
        "stored_status": campaign.status,
        "campaign_type": campaign.campaign_type,
        "channels": channels,
        "focus_industries": focus,
        "progress": progress,
        "on_track": on_track,
        "last_checked_at": _utcnow().isoformat(),
        "compute_tier": "T0",
    }


async def monitor_campaigns_for_product(
    db: AsyncSession,
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> dict:
    result = await db.execute(
        select(Campaign).where(
            Campaign.product_id == product_id,
            Campaign.tenant_id == tenant_id,
        )
    )
    campaigns = list(result.scalars().all())
    reports: list[dict] = []
    updated = 0
    for campaign in campaigns:
        report = await get_campaign_status(db, campaign.id, tenant_id)
        if not report:
            continue
        reports.append(report)
        new_status = report["status"]
        if new_status != campaign.status and new_status in ("active", "needs_attention"):
            config = dict(campaign.config or {})
            config["last_monitor"] = report
            campaign.config = config
            campaign.status = new_status
            updated += 1
    await db.flush()
    return {
        "monitored": len(reports),
        "updated": updated,
        "campaigns": reports,
    }
