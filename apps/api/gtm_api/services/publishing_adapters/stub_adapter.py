"""Stub adapter factory for channels with no real implementation yet. LinkedIn, X,
Medium, Dev.to, and Reddit have real credential-gated adapters in oauth_adapters.py --
this file now only covers the generic "blog" channel, which has no single target
platform to integrate against."""

from __future__ import annotations

from typing import Optional

from gtm_api.models import Artifact, ChannelPost
from gtm_api.services.publishing_adapters.base import ProviderResult


def make_stub_adapter(channel_label: str):
    async def publish(
        artifact: Artifact,
        channel_post: ChannelPost,
        recipient: Optional[str] = None,
    ) -> ProviderResult:
        return ProviderResult(
            status="not_configured",
            error=(
                f"{channel_label} publishing is not configured. Implement "
                f"gtm_api.services.publishing_adapters.{channel_post.channel}_adapter "
                "with real API credentials to enable this channel."
            ),
        )

    return publish


blog_adapter = make_stub_adapter("Blog/CMS webhook")
