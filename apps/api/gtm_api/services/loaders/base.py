"""Source loader protocol and helpers."""

from __future__ import annotations

import hashlib
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import Source
from gtm_api.services.crawler import CrawledPage


class SourceLoader(Protocol):
    async def load(self, source: Source, db: AsyncSession) -> list[CrawledPage]: ...


def page_from_text(
    url: str,
    title: str,
    content: str,
) -> CrawledPage:
    normalized = content.strip()
    content_hash = hashlib.sha256(normalized.encode()).hexdigest()
    return CrawledPage(
        url=url,
        title=title,
        content=normalized[:50000],
        content_hash=content_hash,
        links=[],
    )


def is_youtube_url(url: str | None) -> bool:
    if not url:
        return False
    lower = url.lower()
    return "youtube.com" in lower or "youtu.be" in lower
