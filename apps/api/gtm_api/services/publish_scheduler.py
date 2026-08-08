"""Publish scheduler + retry queue for ChannelPost rows (Phase 6).

Two independent sweeps, both meant to be run periodically by a worker cron job:
  - process_due_scheduled_posts: dispatch posts whose scheduled_at has arrived
  - retry_failed_posts: retry posts that failed delivery, with exponential backoff,
    up to MAX_RETRY_ATTEMPTS

Both reuse services.publishing.dispatch_channel_post so scheduled/retried posts go
through identical suppression-check + adapter-call logic as an immediate publish.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import Artifact, ChannelPost
from gtm_api.services.publishing import dispatch_channel_post
from gtm_api.tenant import audit_log

MAX_RETRY_ATTEMPTS = 5
RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 240]


async def process_due_scheduled_posts(db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(ChannelPost).where(
            ChannelPost.status == "scheduled",
            ChannelPost.scheduled_at <= now,
        )
    )
    due_posts = list(result.scalars().all())

    dispatched = 0
    for post in due_posts:
        artifact = await db.get(Artifact, post.artifact_id)
        if artifact is None:
            post.status = "failed"
            post.error_message = "Source artifact no longer exists"
            continue

        await dispatch_channel_post(db, post, artifact, post.tenant_id)
        await audit_log(
            db, post.tenant_id, None, "publish_scheduled_dispatch", "channel_post",
            resource_id=str(post.id),
            details={"channel": post.channel, "result": post.status},
        )
        dispatched += 1

    return {"checked": len(due_posts), "dispatched": dispatched}


async def retry_failed_posts(db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(ChannelPost).where(
            ChannelPost.status == "failed",
            ChannelPost.retry_count < MAX_RETRY_ATTEMPTS,
            or_(ChannelPost.next_retry_at.is_(None), ChannelPost.next_retry_at <= now),
        )
    )
    candidates = list(result.scalars().all())

    retried = 0
    exhausted = 0
    for post in candidates:
        artifact = await db.get(Artifact, post.artifact_id)
        if artifact is None:
            post.retry_count = MAX_RETRY_ATTEMPTS
            continue

        post.retry_count += 1
        await dispatch_channel_post(db, post, artifact, post.tenant_id)

        if post.status == "failed":
            if post.retry_count >= MAX_RETRY_ATTEMPTS:
                exhausted += 1
            else:
                backoff = RETRY_BACKOFF_MINUTES[min(post.retry_count, len(RETRY_BACKOFF_MINUTES) - 1)]
                post.next_retry_at = now + timedelta(minutes=backoff)

        retried += 1
        await audit_log(
            db, post.tenant_id, None, "publish_retry", "channel_post",
            resource_id=str(post.id),
            details={"channel": post.channel, "attempt": post.retry_count, "result": post.status},
        )

    return {"checked": len(candidates), "retried": retried, "exhausted": exhausted}
