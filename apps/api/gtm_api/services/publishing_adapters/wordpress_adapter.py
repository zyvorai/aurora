"""WordPress REST publishing (application-password auth).

Carries the approved artifact's title/body plus the SEO block stored by the SEO scorer: meta description
as the excerpt and the JSON-LD as a script tag. Reached only through ``publish_artifact`` so the
approval + content-hash gate still applies.
"""

from __future__ import annotations

import html
import json
import re
from typing import Optional

import httpx

from gtm_api.config import get_settings
from gtm_api.models import Artifact, ChannelPost
from gtm_api.services.publishing_adapters.base import ProviderResult

_TIMEOUT = 20.0


def markdown_to_html(md: str) -> str:
    """Small, safe Markdown subset (headings, paragraphs, lists, bold/italic, links); everything is escaped first."""
    out: list[str] = []
    in_list = False

    def inline(t: str) -> str:
        t = html.escape(t)
        t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
        t = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<em>\1</em>", t)
        return re.sub(
            r"\[([^\]]+)\]\((https?://[^)\s]+|/[^)\s]*)\)",
            lambda m: f'<a href="{html.escape(m.group(2), quote=True)}">{m.group(1)}</a>',
            t,
        )

    for line in md.split("\n"):
        stripped = line.strip()
        m = re.match(r"^(#{1,6})\s+(.*)$", stripped)
        li = re.match(r"^[-*]\s+(.*)$", stripped)
        if in_list and not li:
            out.append("</ul>")
            in_list = False
        if m:
            n = len(m.group(1))
            out.append(f"<h{n}>{inline(m.group(2))}</h{n}>")
        elif li:
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{inline(li.group(1))}</li>")
        elif stripped:
            out.append(f"<p>{inline(stripped)}</p>")
    if in_list:
        out.append("</ul>")
    return "\n".join(out)


async def publish(
    artifact: Artifact, channel_post: ChannelPost, recipient: Optional[str] = None
) -> ProviderResult:
    s = get_settings()
    if not s.wordpress_configured:
        return ProviderResult(
            status="not_configured",
            error="WORDPRESS_URL, WORDPRESS_USER and WORDPRESS_APP_PASSWORD must be set to publish to WordPress.",
        )
    seo = (artifact.metadata_ or {}).get("seo") or {}
    body = markdown_to_html(artifact.content or "")
    if seo.get("schema_jsonld"):
        # json.dumps output is placed in a script tag; "</" is escaped so it cannot close the tag early.
        body += '\n<script type="application/ld+json">' + json.dumps(seo["schema_jsonld"]).replace("</", "<\\/") + "</script>"
    payload = {
        "title": seo.get("meta_title") or artifact.title or "Untitled",
        "content": body,
        "excerpt": seo.get("meta_description", ""),
        "status": "publish",
    }
    url = s.wordpress_url.rstrip("/") + "/wp-json/wp/v2/posts"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=False) as client:
            r = await client.post(url, json=payload, auth=(s.wordpress_user, s.wordpress_app_password))
        if r.status_code >= 400:
            return ProviderResult(status="failed", error=f"WordPress API {r.status_code}: {r.text[:500]}")
        return ProviderResult(status="published", provider_message_id=str(r.json().get("id")))
    except httpx.HTTPError as exc:
        return ProviderResult(status="failed", error=str(exc))
