"""Real (credential-gated) publish adapters for LinkedIn, X, Medium, Dev.to, and Reddit.

Each follows the same shape as email_adapter.py: if the operator hasn't configured real
credentials for that platform (see config.py's `*_configured` properties), publish()
returns ProviderResult(status="not_configured") without attempting a network call --
exactly like the SMTP adapter degrades when SMTP_* env vars are unset. Once credentials
ARE configured, these make real API calls; they are not stubs.

Every platform here requires the operator to obtain their own OAuth app / API token
through that platform's developer console -- this code cannot complete that step for
you, only consume the resulting token.
"""

from __future__ import annotations

from typing import Optional

import httpx

from gtm_api.config import get_settings
from gtm_api.models import Artifact, ChannelPost
from gtm_api.services.publishing_adapters.base import ProviderResult

settings = get_settings()

_TIMEOUT = 20.0


async def linkedin_publish(
    artifact: Artifact, channel_post: ChannelPost, recipient: Optional[str] = None
) -> ProviderResult:
    if not settings.linkedin_configured:
        return ProviderResult(
            status="not_configured",
            error="LINKEDIN_ACCESS_TOKEN and LINKEDIN_AUTHOR_URN must be set to publish to LinkedIn.",
        )
    body = {
        "author": settings.linkedin_author_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": artifact.content or artifact.title},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }
    headers = {
        "Authorization": f"Bearer {settings.linkedin_access_token}",
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post("https://api.linkedin.com/v2/ugcPosts", json=body, headers=headers)
        if response.status_code >= 400:
            return ProviderResult(status="failed", error=f"LinkedIn API {response.status_code}: {response.text[:500]}")
        post_id = response.headers.get("x-restli-id") or response.headers.get("X-RestLi-Id")
        return ProviderResult(status="published", provider_message_id=post_id)
    except httpx.HTTPError as exc:
        return ProviderResult(status="failed", error=str(exc))


async def x_publish(
    artifact: Artifact, channel_post: ChannelPost, recipient: Optional[str] = None
) -> ProviderResult:
    if not settings.x_configured:
        return ProviderResult(
            status="not_configured",
            error="X_BEARER_TOKEN must be set to publish to X. Note: X's v2 tweet-create "
            "endpoint requires a user-context token with tweet.write scope, not an "
            "app-only bearer token -- generate one via the OAuth2 user-context flow.",
        )
    text = (artifact.content or artifact.title or "")[:280]
    headers = {"Authorization": f"Bearer {settings.x_bearer_token}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post("https://api.twitter.com/2/tweets", json={"text": text}, headers=headers)
        if response.status_code >= 400:
            return ProviderResult(status="failed", error=f"X API {response.status_code}: {response.text[:500]}")
        data = response.json().get("data", {})
        return ProviderResult(status="published", provider_message_id=data.get("id"))
    except httpx.HTTPError as exc:
        return ProviderResult(status="failed", error=str(exc))


async def medium_publish(
    artifact: Artifact, channel_post: ChannelPost, recipient: Optional[str] = None
) -> ProviderResult:
    if not settings.medium_configured:
        return ProviderResult(
            status="not_configured",
            error="MEDIUM_ACCESS_TOKEN and MEDIUM_AUTHOR_ID must be set to publish to Medium.",
        )
    body = {
        "title": artifact.title or "Untitled",
        "contentFormat": "markdown",
        "content": artifact.content or "",
        "publishStatus": "public",
    }
    headers = {
        "Authorization": f"Bearer {settings.medium_access_token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    url = f"https://api.medium.com/v1/users/{settings.medium_author_id}/posts"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(url, json=body, headers=headers)
        if response.status_code >= 400:
            return ProviderResult(status="failed", error=f"Medium API {response.status_code}: {response.text[:500]}")
        data = response.json().get("data", {})
        return ProviderResult(status="published", provider_message_id=data.get("id"))
    except httpx.HTTPError as exc:
        return ProviderResult(status="failed", error=str(exc))


async def devto_publish(
    artifact: Artifact, channel_post: ChannelPost, recipient: Optional[str] = None
) -> ProviderResult:
    if not settings.devto_configured:
        return ProviderResult(
            status="not_configured",
            error="DEVTO_API_KEY must be set to publish to Dev.to.",
        )
    body = {"article": {"title": artifact.title or "Untitled", "body_markdown": artifact.content or "", "published": True}}
    headers = {"api-key": settings.devto_api_key, "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post("https://dev.to/api/articles", json=body, headers=headers)
        if response.status_code >= 400:
            return ProviderResult(status="failed", error=f"Dev.to API {response.status_code}: {response.text[:500]}")
        data = response.json()
        return ProviderResult(status="published", provider_message_id=str(data.get("id")))
    except httpx.HTTPError as exc:
        return ProviderResult(status="failed", error=str(exc))


async def reddit_publish(
    artifact: Artifact, channel_post: ChannelPost, recipient: Optional[str] = None
) -> ProviderResult:
    if not settings.reddit_configured:
        return ProviderResult(
            status="not_configured",
            error="REDDIT_ACCESS_TOKEN and REDDIT_SUBREDDIT must be set to publish to Reddit.",
        )
    form = {
        "sr": settings.reddit_subreddit,
        "kind": "self",
        "title": artifact.title or "Untitled",
        "text": artifact.content or "",
        "api_type": "json",
    }
    headers = {
        "Authorization": f"Bearer {settings.reddit_access_token}",
        "User-Agent": settings.reddit_user_agent,
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post("https://oauth.reddit.com/api/submit", data=form, headers=headers)
        if response.status_code >= 400:
            return ProviderResult(status="failed", error=f"Reddit API {response.status_code}: {response.text[:500]}")
        payload = response.json()
        errors = payload.get("json", {}).get("errors") or []
        if errors:
            return ProviderResult(status="failed", error=str(errors))
        post_id = payload.get("json", {}).get("data", {}).get("id")
        return ProviderResult(status="published", provider_message_id=post_id)
    except httpx.HTTPError as exc:
        return ProviderResult(status="failed", error=str(exc))
