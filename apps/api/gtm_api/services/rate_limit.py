"""Redis-backed fixed-window rate limiting for public, unauthenticated endpoints.
Redis is already a running dependency in this stack (arq's job queue), so this reuses
it rather than adding a new one.

Fails open on Redis errors -- a rate limiter that can take down public signup because
Redis hiccuped is worse than one that occasionally lets a burst through."""

from __future__ import annotations

import redis.asyncio as aioredis
from fastapi import HTTPException, Request, status

from gtm_api.config import get_settings

settings = get_settings()
_client: aioredis.Redis | None = None


def _get_client() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _client


async def _check_rate_limit(request: Request, key_prefix: str, max_requests: int, window_seconds: int) -> None:
    client_ip = request.client.host if request.client else "unknown"
    key = f"ratelimit:{key_prefix}:{client_ip}"
    try:
        client = _get_client()
        count = await client.incr(key)
        if count == 1:
            await client.expire(key, window_seconds)
    except Exception:
        return
    if count > max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )


async def enforce_portal_signup_rate_limit(request: Request) -> None:
    """Shared bucket across all three portal signup endpoints (customer/reseller/
    salesperson) -- they're the same abuse vector (public, unauthenticated, writes a
    DB row). 5 signup attempts per IP per hour."""
    await _check_rate_limit(request, key_prefix="portal_signup", max_requests=5, window_seconds=3600)
