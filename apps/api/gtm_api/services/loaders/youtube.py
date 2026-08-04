"""YouTube video transcript loader."""

from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import Source
from gtm_api.services.loaders.base import page_from_text


def extract_video_id(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.hostname and "youtu.be" in parsed.hostname:
        return parsed.path.lstrip("/").split("/")[0] or None
    if parsed.hostname and "youtube.com" in parsed.hostname:
        qs = parse_qs(parsed.query)
        if "v" in qs:
            return qs["v"][0]
        match = re.match(r"^/(embed|shorts)/([^/?]+)", parsed.path)
        if match:
            return match.group(2)
    return None


class YouTubeLoader:
    async def load(self, source: Source, db: AsyncSession) -> list:
        url = source.url or ""
        video_id = extract_video_id(url)
        if not video_id:
            raise ValueError("Invalid YouTube URL")

        title = f"YouTube video {video_id}"
        transcript_text = ""
        caption_lang = None

        try:
            from youtube_transcript_api import YouTubeTranscriptApi

            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            transcript = transcript_list.find_transcript(["en", "en-US", "en-GB"])
            try:
                transcript = transcript.translate("en")
            except Exception:
                pass
            segments = transcript.fetch()
            caption_lang = transcript.language_code
            transcript_text = "\n".join(s["text"] for s in segments)
            title = f"YouTube: {video_id}"
        except Exception as exc:
            meta = source.metadata_ or {}
            meta["transcript_warning"] = str(exc)[:200]
            source.metadata_ = meta
            transcript_text = f"(No captions available for video {video_id})"

        meta = source.metadata_ or {}
        meta.update({"video_id": video_id, "caption_lang": caption_lang})
        source.metadata_ = meta

        content = f"# {title}\n\nSource: {url}\n\n## Transcript\n\n{transcript_text}"
        return [page_from_text(url, title, content)]
