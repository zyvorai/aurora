"""Channel -> PublishAdapter registry."""

from __future__ import annotations

from gtm_api.services.publishing_adapters import email_adapter, oauth_adapters, stub_adapter
from gtm_api.services.publishing_adapters.base import ProviderResult, PublishAdapter

ADAPTER_REGISTRY = {
    "email": email_adapter.publish,
    "newsletter": email_adapter.publish,
    "linkedin": oauth_adapters.linkedin_publish,
    "x": oauth_adapters.x_publish,
    "medium": oauth_adapters.medium_publish,
    "devto": oauth_adapters.devto_publish,
    "reddit": oauth_adapters.reddit_publish,
    # No single "blog" platform to integrate against -- stays a stub until a specific
    # CMS webhook target is chosen.
    "blog": stub_adapter.blog_adapter,
}

__all__ = ["ADAPTER_REGISTRY", "ProviderResult", "PublishAdapter"]
