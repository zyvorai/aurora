"""Web crawl loader for website, docs, and blog sources."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import Source, SourceType
from gtm_api.services.crawler import crawl_website, fetch_single_page
from gtm_api.services.loaders.base import is_youtube_url
from gtm_api.services.loaders.youtube import YouTubeLoader


class WebLoader:
    async def load(self, source: Source, db: AsyncSession) -> list:
        if is_youtube_url(source.url):
            return await YouTubeLoader().load(source, db)

        if source.source_type in (SourceType.WEBSITE, SourceType.DOCS, SourceType.BLOG):
            return await crawl_website(source.url or "")

        if source.url:
            page = await fetch_single_page(source.url)
            return [page]
        return []
