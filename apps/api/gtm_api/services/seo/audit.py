"""Deterministic on-page SEO audit of one HTML document (no LLM, no network)."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

TITLE_RANGE = (30, 60)
DESCRIPTION_RANGE = (70, 160)
MIN_WORDS = 300

# Points lost per severity; the score is 100 minus the sum, floored at 0.
_PENALTY = {"critical": 20, "warning": 8, "info": 2}


@dataclass
class Finding:
    id: str
    severity: str  # critical | warning | info
    message: str
    fix: str


@dataclass
class SeoAudit:
    url: str
    score: int
    title: str
    meta_description: str
    canonical: str
    h1: list[str]
    headings: list[tuple[int, str]]
    word_count: int
    images: int
    images_missing_alt: int
    internal_links: int
    external_links: int
    has_open_graph: bool
    jsonld_types: list[str]
    findings: list[Finding] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["headings"] = [list(h) for h in self.headings]
        return d


def _words(text: str) -> int:
    return len(re.findall(r"\b[\w'’-]+\b", text))


def _jsonld_types(soup: BeautifulSoup) -> list[str]:
    types: list[str] = []
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            data = json.loads(tag.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if isinstance(item, dict):
                t = item.get("@type")
                if isinstance(t, str):
                    types.append(t)
                elif isinstance(t, list):
                    types.extend(x for x in t if isinstance(x, str))
    return types


def audit_html(html: str, url: str) -> SeoAudit:
    soup = BeautifulSoup(html, "lxml")
    host = urlparse(url).netloc

    title = soup.title.string.strip() if soup.title and soup.title.string else ""
    desc_tag = soup.find("meta", attrs={"name": re.compile("^description$", re.IGNORECASE)})
    description = (desc_tag.get("content") or "").strip() if desc_tag else ""
    canon_tag = soup.find("link", rel=lambda v: v and "canonical" in v)
    canonical = urljoin(url, canon_tag["href"]) if canon_tag and canon_tag.get("href") else ""
    robots_tag = soup.find("meta", attrs={"name": re.compile("^robots$", re.IGNORECASE)})
    robots = (robots_tag.get("content") or "").lower() if robots_tag else ""
    viewport = soup.find("meta", attrs={"name": re.compile("^viewport$", re.IGNORECASE)})
    html_tag = soup.find("html")
    lang = (html_tag.get("lang") or "").strip() if html_tag else ""
    og = soup.find("meta", property=re.compile("^og:", re.IGNORECASE)) is not None

    headings = [(int(h.name[1]), h.get_text(" ", strip=True)) for h in soup.find_all(re.compile("^h[1-6]$"))]
    h1 = [text for level, text in headings if level == 1]

    images = soup.find_all("img")
    missing_alt = [i for i in images if not (i.get("alt") or "").strip()]

    internal = external = 0
    for a in soup.find_all("a", href=True):
        full = urlparse(urljoin(url, a["href"]))
        if full.scheme not in ("http", "https"):
            continue
        if full.netloc == host:
            internal += 1
        else:
            external += 1

    body = BeautifulSoup(html, "lxml")
    for tag in body(["script", "style", "noscript"]):
        tag.decompose()
    words = _words(body.get_text(" ", strip=True))
    jsonld = _jsonld_types(soup)

    f: list[Finding] = []

    def add(fid: str, sev: str, msg: str, fix: str) -> None:
        f.append(Finding(fid, sev, msg, fix))

    if not title:
        add("title.missing", "critical", "The page has no <title>.", "Add a unique title of 30-60 characters that leads with the topic.")
    elif not TITLE_RANGE[0] <= len(title) <= TITLE_RANGE[1]:
        add("title.length", "warning", f"Title is {len(title)} characters (aim for {TITLE_RANGE[0]}-{TITLE_RANGE[1]}).", "Rewrite the title so it is not truncated or too thin in search results.")
    if not description:
        add("description.missing", "critical", "No meta description.", "Add a 70-160 character summary that earns the click.")
    elif not DESCRIPTION_RANGE[0] <= len(description) <= DESCRIPTION_RANGE[1]:
        add("description.length", "warning", f"Meta description is {len(description)} characters (aim for {DESCRIPTION_RANGE[0]}-{DESCRIPTION_RANGE[1]}).", "Trim or extend the description to fit.")
    if len(h1) == 0:
        add("h1.missing", "critical", "No <h1> heading.", "Add exactly one H1 that states the page topic.")
    elif len(h1) > 1:
        add("h1.multiple", "warning", f"{len(h1)} H1 headings.", "Keep one H1; demote the others to H2.")
    levels = [lvl for lvl, _ in headings]
    if any(b - a > 1 for a, b in zip(levels, levels[1:])):
        add("headings.skip", "info", "Heading levels skip (for example H2 straight to H4).", "Keep a continuous outline so the structure is clear to crawlers and screen readers.")
    if not canonical:
        add("canonical.missing", "warning", "No canonical URL.", 'Add <link rel="canonical"> pointing at the preferred URL.')
    if "noindex" in robots:
        add("robots.noindex", "critical", "The page is marked noindex.", "Remove noindex if this page should appear in search.")
    if not viewport:
        add("viewport.missing", "warning", "No viewport meta tag.", "Add width=device-width so the page is mobile friendly.")
    if not lang:
        add("lang.missing", "info", "<html> has no lang attribute.", "Set lang (for example en) for language targeting and accessibility.")
    if not og:
        add("og.missing", "info", "No Open Graph tags.", "Add og:title, og:description and og:image for rich link previews.")
    if images and missing_alt:
        add("img.alt", "warning", f"{len(missing_alt)} of {len(images)} images lack alt text.", "Describe each meaningful image in its alt attribute.")
    if words < MIN_WORDS:
        add("content.thin", "warning", f"Only {words} words of body text (aim for {MIN_WORDS}+).", "Add substantive, specific content that answers the search intent.")
    if not jsonld:
        add("schema.missing", "info", "No JSON-LD structured data.", "Add schema.org markup (Article, Product, FAQPage) that matches the page.")
    if internal == 0:
        add("links.internal", "info", "No internal links.", "Link to related pages so crawlers and readers can move on.")

    score = max(0, 100 - sum(_PENALTY[x.severity] for x in f))
    return SeoAudit(
        url=url, score=score, title=title, meta_description=description, canonical=canonical,
        h1=h1, headings=headings, word_count=words, images=len(images), images_missing_alt=len(missing_alt),
        internal_links=internal, external_links=external, has_open_graph=og, jsonld_types=jsonld, findings=f,
    )
