"""Real email/SMTP publish adapter -- the one live (non-OAuth) channel."""

from __future__ import annotations

import asyncio
import smtplib
from email.message import EmailMessage
from email.utils import make_msgid

from gtm_api.config import get_settings
from gtm_api.models import Artifact, ChannelPost
from gtm_api.services.publishing_adapters.base import ProviderResult

settings = get_settings()


async def publish(artifact: Artifact, channel_post: ChannelPost) -> ProviderResult:
    if not settings.smtp_configured:
        return ProviderResult(
            status="not_configured",
            error="SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must be set to send email.",
        )
    return await asyncio.to_thread(_send_sync, artifact)


def _send_sync(artifact: Artifact) -> ProviderResult:
    recipient = settings.email_channel_recipient or settings.smtp_from

    message = EmailMessage()
    message["Subject"] = artifact.title or "GTM Platform Update"
    message["From"] = settings.smtp_from
    message["To"] = recipient
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
