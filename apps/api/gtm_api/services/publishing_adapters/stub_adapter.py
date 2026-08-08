"""Stub adapter factory for channels that need OAuth app credentials the
platform operator must register themselves (LinkedIn, X, Medium, Dev.to,
Reddit, generic blog/CMS webhook). Each returns "not_configured" until a real
implementation is wired up behind the same PublishAdapter protocol."""

from __future__ import annotations

from gtm_api.models import Artifact, ChannelPost
from gtm_api.services.publishing_adapters.base import ProviderResult


def make_stub_adapter(channel_label: str):
    async def publish(artifact: Artifact, channel_post: ChannelPost) -> ProviderResult:
        return ProviderResult(
            status="not_configured",
            error=(
                f"{channel_label} publishing is not configured. Implement "
                f"gtm_api.services.publishing_adapters.{channel_post.channel}_adapter "
                "with real API credentials to enable this channel."
            ),
        )

    return publish


linkedin_adapter = make_stub_adapter("LinkedIn")
x_adapter = make_stub_adapter("X/Twitter")
medium_adapter = make_stub_adapter("Medium")
devto_adapter = make_stub_adapter("Dev.to")
reddit_adapter = make_stub_adapter("Reddit")
blog_adapter = make_stub_adapter("Blog/CMS webhook")
