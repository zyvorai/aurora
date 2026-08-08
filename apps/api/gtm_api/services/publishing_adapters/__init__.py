"""Channel -> PublishAdapter registry."""

from __future__ import annotations

from gtm_api.services.publishing_adapters import email_adapter, stub_adapter
from gtm_api.services.publishing_adapters.base import ProviderResult, PublishAdapter

ADAPTER_REGISTRY = {
    "email": email_adapter.publish,
    "newsletter": email_adapter.publish,
    "linkedin": stub_adapter.linkedin_adapter,
    "x": stub_adapter.x_adapter,
    "medium": stub_adapter.medium_adapter,
    "devto": stub_adapter.devto_adapter,
    "reddit": stub_adapter.reddit_adapter,
    "blog": stub_adapter.blog_adapter,
}

__all__ = ["ADAPTER_REGISTRY", "ProviderResult", "PublishAdapter"]
