"""Dispatch source loading by type."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import Source, SourceType
from gtm_api.services.crawler import CrawledPage
from gtm_api.services.loaders.audio_video import AudioVideoLoader
from gtm_api.services.loaders.base import is_youtube_url
from gtm_api.services.loaders.database import DatabaseLoader
from gtm_api.services.loaders.file import FileLoader
from gtm_api.services.loaders.github import GitHubLoader
from gtm_api.services.loaders.openapi import OpenAPILoader
from gtm_api.services.loaders.spreadsheet import SpreadsheetLoader
from gtm_api.services.loaders.web import WebLoader
from gtm_api.services.loaders.youtube import YouTubeLoader

_web = WebLoader()
_file = FileLoader()
_spreadsheet = SpreadsheetLoader()
_youtube = YouTubeLoader()
_audio_video = AudioVideoLoader()
_github = GitHubLoader()
_openapi = OpenAPILoader()
_database = DatabaseLoader()


async def load_source_pages(source: Source, db: AsyncSession) -> list[CrawledPage]:
    st = source.source_type

    if is_youtube_url(source.url) and st in (SourceType.VIDEO, SourceType.WEBSITE, SourceType.DOCS):
        return await _youtube.load(source, db)

    if st in (SourceType.WEBSITE, SourceType.DOCS, SourceType.BLOG):
        return await _web.load(source, db)

    if st == SourceType.PDF:
        return await _file.load(source, db)

    if st == SourceType.FILE:
        return await _file.load(source, db)

    if st == SourceType.SPREADSHEET:
        return await _spreadsheet.load(source, db)

    if st == SourceType.VIDEO:
        if source.storage_key:
            return await _audio_video.load(source, db)
        if source.url:
            return await _youtube.load(source, db)
        raise ValueError("Video source requires URL or uploaded file")

    if st == SourceType.AUDIO:
        return await _audio_video.load(source, db)

    if st == SourceType.GITHUB:
        return await _github.load(source, db)

    if st == SourceType.OPENAPI:
        return await _openapi.load(source, db)

    if st == SourceType.DATABASE:
        return await _database.load(source, db)

    return await _web.load(source, db)
