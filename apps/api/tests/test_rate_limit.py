"""Redis-backed fixed-window rate limiter for public portal signup endpoints.
Uses a fake async Redis client (not a real connection) so behavior is deterministic
regardless of whether Redis is actually running in the test environment."""

from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from gtm_api.services import rate_limit


class FakeRedis:
    def __init__(self):
        self.counts: dict[str, int] = {}

    async def incr(self, key: str) -> int:
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    async def expire(self, key: str, seconds: int) -> None:
        pass


class FakeRequest:
    def __init__(self, ip: str):
        self.client = type("Client", (), {"host": ip})()


@pytest.fixture(autouse=True)
def reset_client(monkeypatch):
    monkeypatch.setattr(rate_limit, "_client", None)
    yield
    rate_limit._client = None


class TestRateLimit:
    async def test_allows_requests_under_the_limit(self, monkeypatch):
        fake = FakeRedis()
        monkeypatch.setattr(rate_limit, "_get_client", lambda: fake)

        for _ in range(5):
            await rate_limit._check_rate_limit(FakeRequest("1.2.3.4"), "test", max_requests=5, window_seconds=3600)

    async def test_blocks_requests_over_the_limit(self, monkeypatch):
        fake = FakeRedis()
        monkeypatch.setattr(rate_limit, "_get_client", lambda: fake)

        for _ in range(5):
            await rate_limit._check_rate_limit(FakeRequest("1.2.3.4"), "test", max_requests=5, window_seconds=3600)

        with pytest.raises(HTTPException) as exc_info:
            await rate_limit._check_rate_limit(FakeRequest("1.2.3.4"), "test", max_requests=5, window_seconds=3600)
        assert exc_info.value.status_code == 429

    async def test_different_ips_have_independent_buckets(self, monkeypatch):
        fake = FakeRedis()
        monkeypatch.setattr(rate_limit, "_get_client", lambda: fake)

        for _ in range(5):
            await rate_limit._check_rate_limit(FakeRequest("1.1.1.1"), "test", max_requests=5, window_seconds=3600)

        # A different IP still has a fresh bucket.
        await rate_limit._check_rate_limit(FakeRequest("2.2.2.2"), "test", max_requests=5, window_seconds=3600)

    async def test_fails_open_when_redis_is_unavailable(self, monkeypatch):
        broken = AsyncMock()
        broken.incr.side_effect = ConnectionError("redis unreachable")
        monkeypatch.setattr(rate_limit, "_get_client", lambda: broken)

        # Should not raise -- a rate limiter outage must never block public signup.
        await rate_limit._check_rate_limit(FakeRequest("9.9.9.9"), "test", max_requests=1, window_seconds=3600)
