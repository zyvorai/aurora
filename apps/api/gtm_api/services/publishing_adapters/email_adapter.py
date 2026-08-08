"""Real email/SMTP publish adapter -- the one live (non-OAuth) channel."""

from __future__ import annotations

import asyncio
import smtplib
from email.message import EmailMessage
from email.utils import make_msgid
from typing import Optional

from gtm_api.config import get_settings
from gtm_api.models import Artifact, ChannelPost
from gtm_api.services.publishing_adapters.base import ProviderResult

settings = get_settings()


async def publish(
    artifact: Artifact,
    channel_post: ChannelPost,
    recipient: Optional[str] = None,
) -> ProviderResult:
    if not settings.smtp_configured:
        return ProviderResult(
            status="not_configured",
            error="SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must be set to send email.",
        )
    return await asyncio.to_thread(_send_sync, artifact, recipient)


async def send_transactional_email(to: str, subject: str, body: str) -> ProviderResult:
    """One-off transactional email (e.g. portal account approved/rejected) -- unlike
    publish() above, not driven by an Artifact/ChannelPost from the content-publishing
    pipeline, just a plain subject/body sent to one recipient."""
    if not settings.smtp_configured:
        return ProviderResult(
            status="not_configured",
            error="SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must be set to send email.",
        )
    return await asyncio.to_thread(_send_transactional_sync, to, subject, body)


def _send_transactional_sync(to: str, subject: str, body: str) -> ProviderResult:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Message-Id"] = make_msgid()
    message.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(message)
    except Exception as exc:
        return ProviderResult(status="failed", error=str(exc))

    return ProviderResult(status="published", provider_message_id=message["Message-Id"])


def _send_sync(artifact: Artifact, recipient: Optional[str] = None) -> ProviderResult:
    resolved_recipient = (
        recipient
        or (artifact.metadata_ or {}).get("recipient_email")
        or settings.email_channel_recipient
        or settings.smtp_from
    )

    message = EmailMessage()
    message["Subject"] = artifact.title or "Emissary Update"
    message["From"] = settings.smtp_from
    message["To"] = resolved_recipient
    message["Message-Id"] = make_msgid()
    message.set_content(artifact.content or "")

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(message)
    except Exception as exc:
        return ProviderResult(status="failed", error=str(exc))

    return ProviderResult(status="published", provider_message_id=message["Message-Id"])
