"""Meta tag suggestions and JSON-LD builders (deterministic)."""

from __future__ import annotations

import re
from typing import Optional


def _clip(text: str, limit: int) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rsplit(" ", 1)[0]
    return cut.rstrip(" ,;:-") + "…"


def suggest_meta(title: str, body: str, keyword: str = "") -> dict[str, str]:
    """A title (<=60) and description (<=160) drawn from the draft itself - never invented facts."""
    first_para = next((p.strip() for p in re.split(r"\n\s*\n", body) if p.strip() and not p.lstrip().startswith("#")), "")
    first_para = re.sub(r"[#>*_`]|\[([^\]]+)\]\([^)]*\)", lambda m: m.group(1) or "", first_para)
    meta_title = _clip(title, 60)
    if keyword and keyword.lower() not in meta_title.lower() and len(meta_title) + len(keyword) + 3 <= 60:
        meta_title = f"{meta_title} | {keyword}"
    return {"meta_title": meta_title, "meta_description": _clip(first_para, 160)}


def article_jsonld(
    headline: str,
    description: str,
    url: str = "",
    author: str = "",
    publisher: str = "",
    date_published: Optional[str] = None,
) -> dict:
    data: dict = {"@context": "https://schema.org", "@type": "Article", "headline": _clip(headline, 110), "description": description}
    if url:
        data["mainEntityOfPage"] = {"@type": "WebPage", "@id": url}
    if author:
        data["author"] = {"@type": "Organization", "name": author}
    if publisher:
        data["publisher"] = {"@type": "Organization", "name": publisher}
    if date_published:
        data["datePublished"] = date_published
    return data
