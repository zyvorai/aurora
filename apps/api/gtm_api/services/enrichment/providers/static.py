"""Offline enrichment heuristics — always available, no API keys."""

from __future__ import annotations

from gtm_api.services.enrichment.types import EnrichmentResult

_SIZE_HINTS = {
    "inc": "201-500",
    "corp": "501-1000",
    "enterprise": "1000+",
    "labs": "11-50",
    "io": "51-200",
}


def enrich_static(company_name: str, domain: str | None = None) -> EnrichmentResult | None:
    name = (company_name or "").strip()
    if not name:
        return None

    dom = (domain or "").strip().lower().removeprefix("https://").removeprefix("http://").split("/")[0]
    if not dom and "." in name:
        # e.g. acme.com pasted as company name
        dom = name.lower()

    company_size = None
    if dom:
        tld = dom.rsplit(".", 1)[-1]
        for hint, size in _SIZE_HINTS.items():
            if hint in dom:
                company_size = size
                break
        if tld in ("io", "dev", "ai"):
            company_size = company_size or "51-200"

    personas = [{"title": "CTO", "email": f"cto@{dom}"}] if dom and "@" not in dom else [{"title": "CTO"}]
    emails = [f"hello@{dom}"] if dom and "@" not in dom else []

    return EnrichmentResult(
        company_name=name,
        domain=dom or None,
        company_size=company_size,
        personas=personas,
        emails=emails,
        provider="static",
        confidence=0.35 if dom else 0.2,
    )
