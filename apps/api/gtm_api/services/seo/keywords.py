"""Keyword providers.

``GroundedProvider`` (default) mines terms from the product's own knowledge base; every value it
returns is an estimate and says so. ``DataForSEOProvider`` adds measured search volume and
``SearchConsoleProvider`` returns the customer's own first-party query data. Providers are chosen
by ``SEO_PROVIDER`` and never fabricate numbers they were not given.
"""

from __future__ import annotations

import base64
import re
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from typing import Optional, Protocol
from urllib.parse import quote

import httpx

from gtm_api.config import get_settings

_STOP = frozenset(
    "a an and are as at be by for from has have how in is it its of on or that the their this to was we with you your our can will not "
    "more most other such than then they them these those which who what when where why into over also any all each both about".split()
)
_TRANSACTIONAL = ("buy", "pricing", "price", "cost", "demo", "trial", "quote", "subscribe", "download")
_COMMERCIAL = ("best", "vs", "versus", "alternative", "alternatives", "compare", "comparison", "review", "reviews", "top")
_INFORMATIONAL = ("how", "what", "why", "guide", "tutorial", "example", "examples", "learn", "tips", "when", "which")
_TIMEOUT = 15.0


@dataclass
class Keyword:
    keyword: str
    intent: str  # informational | commercial | transactional | navigational
    source: str  # estimate | dataforseo | search_console
    volume: Optional[int] = None  # monthly searches (provider-measured only)
    difficulty: Optional[int] = None  # 0-100 (provider-measured only)
    clicks: Optional[int] = None  # first-party (Search Console only)
    impressions: Optional[int] = None
    position: Optional[float] = None
    score: float = 0.0  # ordering key within the provider's own scale

    def to_dict(self) -> dict:
        return asdict(self)


class KeywordProvider(Protocol):
    name: str

    async def suggest(self, seed: str, corpus: list[str], limit: int = 25) -> list[Keyword]: ...


def classify_intent(keyword: str) -> str:
    words = keyword.lower().split()
    if any(w in _TRANSACTIONAL for w in words):
        return "transactional"
    if any(w in _COMMERCIAL for w in words):
        return "commercial"
    if any(w in _INFORMATIONAL for w in words):
        return "informational"
    return "informational"


def mine_terms(corpus: list[str], seed: str = "", limit: int = 25) -> list[tuple[str, int]]:
    """Frequent 1-3 word phrases (stop-word trimmed), boosted when they share a word with the seed."""
    counts: Counter[str] = Counter()
    seed_words = {w for w in re.findall(r"[a-z0-9]+", seed.lower()) if w not in _STOP}
    for doc in corpus:
        tokens = re.findall(r"[a-z0-9][a-z0-9+.#-]*", doc.lower())
        for n in (1, 2, 3):
            for i in range(len(tokens) - n + 1):
                gram = tokens[i : i + n]
                if gram[0] in _STOP or gram[-1] in _STOP or any(len(t) < 3 for t in (gram[0], gram[-1])):
                    continue
                if n == 1 and len(gram[0]) < 4:
                    continue
                counts[" ".join(gram)] += 1
    ranked: list[tuple[str, float]] = []
    for term, c in counts.items():
        if c < 2:
            continue
        boost = 2.0 if seed_words & set(term.split()) else 1.0
        ranked.append((term, c * boost * (1 + 0.35 * (len(term.split()) - 1))))
    ranked.sort(key=lambda x: (-x[1], x[0]))
    return [(t, int(round(s))) for t, s in ranked[:limit]]


class GroundedProvider:
    name = "estimate"

    async def suggest(self, seed: str, corpus: list[str], limit: int = 25) -> list[Keyword]:
        out = [
            Keyword(keyword=t, intent=classify_intent(t), source="estimate", score=float(s))
            for t, s in mine_terms(corpus, seed, limit)
        ]
        if seed.strip() and all(k.keyword != seed.strip().lower() for k in out):
            out.insert(0, Keyword(keyword=seed.strip().lower(), intent=classify_intent(seed), source="estimate", score=0.0))
        return out[:limit]


class DataForSEOProvider:
    name = "dataforseo"
    url = "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live"

    def __init__(self, login: str, password: str, location_code: int = 2840, language_code: str = "en"):
        self._auth = base64.b64encode(f"{login}:{password}".encode()).decode()
        self._loc, self._lang = location_code, language_code

    async def suggest(self, seed: str, corpus: list[str], limit: int = 25) -> list[Keyword]:
        candidates = [t for t, _ in mine_terms(corpus, seed, limit)]
        if seed.strip():
            candidates.insert(0, seed.strip().lower())
        candidates = list(dict.fromkeys(candidates))[:limit]
        if not candidates:
            return []
        body = [{"keywords": candidates, "location_code": self._loc, "language_code": self._lang}]
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.post(self.url, json=body, headers={"Authorization": f"Basic {self._auth}"})
        r.raise_for_status()
        rows = ((r.json().get("tasks") or [{}])[0].get("result")) or []
        out = [
            Keyword(
                keyword=str(row["keyword"]), intent=classify_intent(str(row["keyword"])), source="dataforseo",
                volume=row.get("search_volume"), difficulty=row.get("competition_index"),
                score=float(row.get("search_volume") or 0),
            )
            for row in rows if row.get("keyword")
        ]
        out.sort(key=lambda k: -k.score)
        return out[:limit]


class SearchConsoleProvider:
    """The customer's own queries (clicks, impressions, average position); read-only."""

    name = "search_console"

    def __init__(self, access_token: str, site_url: str, days: int = 28):
        self._token, self._site, self._days = access_token, site_url, days

    async def suggest(self, seed: str, corpus: list[str], limit: int = 25) -> list[Keyword]:
        end = date.today() - timedelta(days=2)  # Search Console data lags ~2 days
        start = end - timedelta(days=self._days)
        body: dict = {"startDate": start.isoformat(), "endDate": end.isoformat(), "dimensions": ["query"], "rowLimit": min(limit * 4, 1000)}
        if seed.strip():
            body["dimensionFilterGroups"] = [{"filters": [{"dimension": "query", "operator": "contains", "expression": seed.strip()}]}]
        url = f"https://www.googleapis.com/webmasters/v3/sites/{quote(self._site, safe='')}/searchAnalytics/query"
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.post(url, json=body, headers={"Authorization": f"Bearer {self._token}"})
        r.raise_for_status()
        out = [
            Keyword(
                keyword=row["keys"][0], intent=classify_intent(row["keys"][0]), source="search_console",
                clicks=int(row.get("clicks", 0)), impressions=int(row.get("impressions", 0)),
                position=round(float(row.get("position", 0)), 1), score=float(row.get("impressions", 0)),
            )
            for row in r.json().get("rows", []) if row.get("keys")
        ]
        out.sort(key=lambda k: -k.score)
        return out[:limit]


def get_provider(name: Optional[str] = None) -> KeywordProvider:
    """Resolve the configured provider; falls back to the grounded estimator when credentials are missing."""
    s = get_settings()
    choice = (name or s.seo_provider or "grounded").lower()
    if choice == "dataforseo" and s.dataforseo_configured:
        return DataForSEOProvider(s.dataforseo_login, s.dataforseo_password)
    if choice == "search_console" and s.gsc_configured:
        return SearchConsoleProvider(s.gsc_access_token, s.gsc_site_url)
    return GroundedProvider()
