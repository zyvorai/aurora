"""Waterfall enrichment — try providers in order until one succeeds."""

from __future__ import annotations

from gtm_api.config import get_settings
from gtm_api.services.enrichment.providers.apollo import enrich_apollo, enrich_apollo_contact
from gtm_api.services.enrichment.providers.static import enrich_static
from gtm_api.services.enrichment.types import EnrichmentResult

settings = get_settings()


async def enrich_candidate(company_name: str, domain: str | None = None) -> EnrichmentResult:
    """Run the configured provider chain and return the best result."""
    if not settings.enrichment_enabled:
        static = enrich_static(company_name, domain)
        return static or EnrichmentResult(company_name=company_name, domain=domain)

    providers = []
    if settings.apollo_api_key:
        providers.append("apollo")
    providers.append("static")

    best: EnrichmentResult | None = None
    for name in providers:
        result: EnrichmentResult | None
        if name == "apollo":
            result = await enrich_apollo(company_name, domain)
        else:
            result = enrich_static(company_name, domain)
        if result and (best is None or result.confidence > best.confidence):
            best = result
        if best and best.confidence >= 0.8:
            break

    return best or EnrichmentResult(company_name=company_name, domain=domain)


async def enrich_contact(
    *,
    email: str | None = None,
    domain: str | None = None,
    title: str | None = None,
    company_name: str | None = None,
) -> EnrichmentResult:
    """Contact-level waterfall — Apollo people search, then org enrichment, then static."""
    if not settings.enrichment_enabled:
        static = enrich_static(company_name or email or "", domain)
        return static or EnrichmentResult(company_name=company_name or "", domain=domain, emails=[email] if email else [])

    contact: EnrichmentResult | None = None
    if settings.apollo_api_key:
        contact = await enrich_apollo_contact(
            email=email, domain=domain, title=title, company_name=company_name,
        )
    if contact and contact.confidence >= 0.85:
        return contact

    org = await enrich_candidate(company_name or (email.split("@")[-1] if email and "@" in email else ""), domain)
    if contact:
        merged = EnrichmentResult(
            company_name=contact.company_name or org.company_name,
            domain=contact.domain or org.domain,
            industry=contact.industry or org.industry,
            company_size=contact.company_size or org.company_size,
            geo=contact.geo or org.geo,
            personas=contact.personas or org.personas,
            emails=contact.emails or org.emails,
            phones=contact.phones or org.phones,
            provider=contact.provider,
            confidence=max(contact.confidence, org.confidence),
            raw={**(org.raw or {}), **(contact.raw or {})},
        )
        return merged
    return org


async def enrich_candidates(candidates: list[dict]) -> list[dict]:
    enriched: list[dict] = []
    for item in candidates:
        result = await enrich_candidate(item.get("company_name", ""), item.get("domain"))
        enriched.append(result.apply_to(item))
    return enriched
