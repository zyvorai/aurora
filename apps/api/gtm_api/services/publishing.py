"""Omnichannel publishing service (Phase 6)."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import content_hash
from gtm_api.config import get_settings
from gtm_api.models import Approval, ApprovalStatus, Artifact, ChannelPost
from gtm_api.services.enterprise import is_suppressed
from gtm_api.services.publishing_adapters import ADAPTER_REGISTRY
from gtm_api.tenant import audit_log

settings = get_settings()

EMAIL_CHANNELS = {"email", "newsletter"}


CHANNEL_HANDLERS = {
    "linkedin": "LinkedIn API",
    "x": "X/Twitter API",
    "medium": "Medium API",
    "devto": "Dev.to API",
    "reddit": "Reddit API",
    "blog": "CMS Webhook",
    "newsletter": "Email Service",
    "email": "SMTP",
}


async def dispatch_channel_post(
    db: AsyncSession,
    post: ChannelPost,
    artifact: Artifact,
    tenant_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
    recipient: Optional[str] = None,
) -> None:
    """Resolve recipient (email channels), suppression-check, and call the channel
    adapter — mutates `post` in place. Shared by the immediate-publish path below and
    the scheduler/retry queue (services/publish_scheduler.py) so both go through
    identical dispatch logic."""
    resolved_recipient = None
    if post.channel in EMAIL_CHANNELS:
        resolved_recipient = (
            recipient
            or (artifact.metadata_ or {}).get("recipient_email")
            or settings.email_channel_recipient
            or settings.smtp_from
        )
        if await is_suppressed(db, tenant_id, resolved_recipient):
            post.status = "blocked"
            post.error_message = f"Recipient {resolved_recipient} is on the suppression list."
            await audit_log(
                db, tenant_id, user_id, "publish_blocked", "channel_post",
                resource_id=str(post.id),
                details={"channel": post.channel, "artifact_id": str(artifact.id), "recipient": resolved_recipient},
            )
            return

    adapter = ADAPTER_REGISTRY.get(post.channel)
    if adapter is None:
        post.status = "failed"
        post.error_message = f"No adapter registered for channel '{post.channel}'"
        return

    result = await adapter(artifact, post, resolved_recipient)
    post.status = result.status
    post.provider_message_id = result.provider_message_id
    post.error_message = result.error
    if result.status == "published":
        post.published_at = datetime.now(timezone.utc)


async def publish_artifact(
    db: AsyncSession,
    artifact: Artifact,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    channel: str,
    scheduled_at: Optional[datetime] = None,
    recipient: Optional[str] = None,
) -> ChannelPost:
    approval_result = await db.execute(
        select(Approval).where(
            Approval.artifact_id == artifact.id,
            Approval.status == ApprovalStatus.APPROVED,
            Approval.content_hash == artifact.content_hash,
        )
    )
    approval = approval_result.scalar_one_or_none()
    if not approval:
        raise ValueError("Artifact must be approved before publishing")

    idempotency_key = f"{artifact.id}:{channel}:{artifact.content_hash[:16]}"

    existing = await db.execute(
        select(ChannelPost).where(ChannelPost.idempotency_key == idempotency_key)
    )
    if existing.scalar_one_or_none():
        raise ValueError("Already published or scheduled with this content")

    post = ChannelPost(
        artifact_id=artifact.id,
        tenant_id=tenant_id,
        channel=channel,
        status="scheduled" if scheduled_at else "draft",
        scheduled_at=scheduled_at,
        idempotency_key=idempotency_key,
    )
    db.add(post)
    await db.flush()

    if not scheduled_at:
        await dispatch_channel_post(db, post, artifact, tenant_id, user_id, recipient)
        if post.status == "blocked":
            return post

    await audit_log(
        db, tenant_id, user_id, "publish", "channel_post",
        resource_id=str(post.id),
        details={"channel": channel, "artifact_id": str(artifact.id)},
    )

    return post


async def get_publish_status(
    db: AsyncSession,
    channel_post_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> Optional[ChannelPost]:
    result = await db.execute(
        select(ChannelPost).where(
            ChannelPost.id == channel_post_id,
            ChannelPost.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()
