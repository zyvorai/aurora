"""Pluggable publish-channel adapter protocol (Phase 6)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol

from gtm_api.models import Artifact, ChannelPost


@dataclass
class ProviderResult:
    status: str  # "published" | "scheduled" | "failed" | "not_configured"
    provider_message_id: Optional[str] = None
    error: Optional[str] = None


class PublishAdapter(Protocol):
    async def publish(
        self,
        artifact: Artifact,
        channel_post: ChannelPost,
        recipient: Optional[str] = None,
    ) -> ProviderResult:
        ...
