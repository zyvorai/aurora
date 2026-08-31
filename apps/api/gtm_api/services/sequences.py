"""List and edit outreach email sequences."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import content_hash
from gtm_api.models import Artifact, ArtifactType, ChannelPost


async def list_product_sequences(
    db: AsyncSession,
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> list[dict]:
    """Return outreach sequences grouped by parent artifact."""
    result = await db.execute(
        select(Artifact)
        .where(
            Artifact.product_id == product_id,
            Artifact.tenant_id == tenant_id,
            Artifact.artifact_type == ArtifactType.OUTREACH,
        )
        .order_by(Artifact.created_at.desc())
    )
    parents = [
        a for a in result.scalars().all()
        if (a.metadata_ or {}).get("follow_up_sequence") and not (a.metadata_ or {}).get("sequence_step")
    ]

    sequences: list[dict] = []
    for parent in parents:
        meta = parent.metadata_ or {}
        steps_meta = meta.get("follow_up_sequence") or []
        if not isinstance(steps_meta, list):
            continue

        child_result = await db.execute(
            select(ChannelPost, Artifact)
            .join(Artifact, ChannelPost.artifact_id == Artifact.id)
            .where(
                Artifact.product_id == product_id,
                Artifact.tenant_id == tenant_id,
            )
        )
        child_by_step: dict[int, tuple[ChannelPost, Artifact]] = {}
        for post, artifact in child_result.all():
            ameta = artifact.metadata_ or {}
            if ameta.get("parent_artifact_id") == str(parent.id) and isinstance(ameta.get("sequence_step"), int):
                child_by_step[ameta["sequence_step"]] = (post, artifact)

        steps: list[dict] = []
        for idx, step in enumerate(steps_meta):
            if not isinstance(step, dict):
                continue
            step_no = idx + 1
            post, child = child_by_step.get(step_no, (None, None))
            steps.append({
                "step": step_no,
                "day": int(step.get("day") or step_no * 3),
                "subject": step.get("subject") or f"Follow-up {step_no}",
                "body": step.get("body") or "",
                "status": post.status if post else "draft",
                "scheduled_at": post.scheduled_at.isoformat() if post and post.scheduled_at else None,
                "channel_post_id": str(post.id) if post else None,
                "artifact_id": str(child.id) if child else None,
            })

        sequences.append({
            "parent_artifact_id": str(parent.id),
            "title": parent.title,
            "recipient": meta.get("recipient_email"),
            "status": parent.status.value if hasattr(parent.status, "value") else str(parent.status),
            "steps": steps,
        })

    return sequences


async def update_outreach_sequence(
    db: AsyncSession,
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
    artifact_id: uuid.UUID,
    steps: list[dict],
    *,
    recipient: str | None = None,
) -> dict:
    """Update follow_up_sequence on a parent outreach artifact and reschedule pending posts."""
    result = await db.execute(
        select(Artifact).where(
            Artifact.id == artifact_id,
            Artifact.product_id == product_id,
            Artifact.tenant_id == tenant_id,
            Artifact.artifact_type == ArtifactType.OUTREACH,
        )
    )
    parent = result.scalar_one_or_none()
    if not parent:
        raise ValueError("Outreach artifact not found")

    meta = dict(parent.metadata_ or {})
    normalized: list[dict] = []
    for idx, step in enumerate(steps):
        if not isinstance(step, dict):
            continue
        normalized.append({
            "day": int(step.get("day") or (idx + 1) * 3),
            "subject": str(step.get("subject") or f"Follow-up {idx + 1}"),
            "body": str(step.get("body") or ""),
        })
    meta["follow_up_sequence"] = normalized
    if recipient:
        meta["recipient_email"] = recipient.strip()
    parent.metadata_ = meta

    child_result = await db.execute(
        select(ChannelPost, Artifact)
        .join(Artifact, ChannelPost.artifact_id == Artifact.id)
        .where(
            Artifact.product_id == product_id,
            Artifact.tenant_id == tenant_id,
        )
    )
    existing: dict[int, tuple[ChannelPost, Artifact]] = {}
    for post, artifact in child_result.all():
        ameta = artifact.metadata_ or {}
        if ameta.get("parent_artifact_id") == str(parent.id) and isinstance(ameta.get("sequence_step"), int):
            existing[ameta["sequence_step"]] = (post, artifact)

    now = datetime.now(timezone.utc)
    recipient_email = meta.get("recipient_email")

    for idx, step in enumerate(normalized):
        step_no = idx + 1
        post, child = existing.get(step_no, (None, None))
        scheduled_at = now + timedelta(days=step["day"])
        step_content = json.dumps({"subject": step["subject"], "body": step["body"]}, indent=2)

        if child is None:
            child = Artifact(
                product_id=product_id,
                tenant_id=tenant_id,
                artifact_type=ArtifactType.OUTREACH,
                title=step["subject"],
                content=step_content,
                content_hash=content_hash(step_content),
                status=parent.status,
                metadata_={
                    "recipient_email": recipient_email,
                    "parent_artifact_id": str(parent.id),
                    "sequence_step": step_no,
                    "subject": step["subject"],
                },
                created_by=parent.created_by,
            )
            db.add(child)
            await db.flush()
            post = ChannelPost(
                artifact_id=child.id,
                tenant_id=tenant_id,
                channel="email",
                status="scheduled",
                scheduled_at=scheduled_at,
                idempotency_key=f"seq:{parent.id}:{step_no}:{parent.content_hash[:12]}",
            )
            db.add(post)
        else:
            child.title = step["subject"]
            child.content = step_content
            child.content_hash = content_hash(step_content)
            child_meta = dict(child.metadata_ or {})
            child_meta["subject"] = step["subject"]
            child_meta["recipient_email"] = recipient_email
            child.metadata_ = child_meta
            if post and post.status in ("scheduled", "failed", "draft"):
                post.scheduled_at = scheduled_at
                post.status = "scheduled"
                post.error_message = None

    await db.flush()
    return {"parent_artifact_id": str(parent.id), "steps": len(normalized)}
