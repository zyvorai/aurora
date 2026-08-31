"""Schedule multi-step outreach sequences via ChannelPost."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import content_hash
from gtm_api.models import Artifact, ArtifactType, ChannelPost


async def schedule_outreach_sequence(
    db: AsyncSession,
    artifact: Artifact,
    tenant_id: uuid.UUID,
    *,
    recipient: str | None = None,
    base_time: datetime | None = None,
) -> list[ChannelPost]:
    """Create scheduled ChannelPost rows for follow_up_sequence steps."""
    if artifact.artifact_type != ArtifactType.OUTREACH:
        return []

    meta = artifact.metadata_ or {}
    steps = meta.get("follow_up_sequence") or []
    if not isinstance(steps, list) or not steps:
        return []

    now = base_time or datetime.now(timezone.utc)
    scheduled: list[ChannelPost] = []

    for idx, step in enumerate(steps):
        if not isinstance(step, dict):
            continue
        day = int(step.get("day") or (idx + 1) * 3)
        subject = step.get("subject") or f"Follow-up {idx + 1}"
        body = step.get("body") or ""
        scheduled_at = now + timedelta(days=day)
        step_content = json.dumps({"subject": subject, "body": body}, indent=2)

        step_artifact = Artifact(
            product_id=artifact.product_id,
            tenant_id=tenant_id,
            artifact_type=ArtifactType.OUTREACH,
            title=subject,
            content=step_content,
            content_hash=content_hash(step_content),
            status=artifact.status,
            metadata_={
                "recipient_email": recipient or meta.get("recipient_email"),
                "parent_artifact_id": str(artifact.id),
                "sequence_step": idx + 1,
                "subject": subject,
            },
            created_by=artifact.created_by,
        )
        db.add(step_artifact)
        await db.flush()

        idempotency_key = f"seq:{artifact.id}:{idx}:{artifact.content_hash[:12]}"
        post = ChannelPost(
            artifact_id=step_artifact.id,
            tenant_id=tenant_id,
            channel="email",
            status="scheduled",
            scheduled_at=scheduled_at,
            idempotency_key=idempotency_key,
        )
        db.add(post)
        scheduled.append(post)

    await db.flush()
    return scheduled
