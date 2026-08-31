"""Apollo.io enrichment provider — requires APOLLO_API_KEY."""

from __future__ import annotations

import logging

import httpx

from gtm_api.config import get_settings
from gtm_api.services.enrichment.types import EnrichmentResult

logger = logging.getLogger(__name__)
settings = get_settings()


async def enrich_apollo(company_name: str, domain: str | None = None) -> EnrichmentResult | None:
    api_key = (settings.apollo_api_key or "").strip()
    if not api_key:
        return None

    payload: dict = {"page": 1, "per_page": 1}
    if domain:
        payload["q_organization_domains"] = domain.replace("https://", "").split("/")[0]
    else:
        payload["q_organization_name"] = company_name

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(
                "https://api.apollo.io/api/v1/mixed_companies/search",
                headers={"Content-Type": "application/json", "X-Api-Key": api_key},
                json=payload,
            )
            if resp.status_code >= 400:
                logger.warning("Apollo enrichment failed: %s %s", resp.status_code, resp.text[:200])
                return None
            data = resp.json()
    except Exception as exc:
        logger.warning("Apollo enrichment error: %s", exc)
        return None

    orgs = data.get("organizations") or data.get("accounts") or []
    if not orgs:
        return None

    org = orgs[0]
    dom = org.get("primary_domain") or org.get("website_url") or domain
    if isinstance(dom, str):
        dom = dom.replace("https://", "").replace("http://", "").split("/")[0] or None

    industry = None
    if org.get("industry"):
        industry = org["industry"]
    elif org.get("industries"):
        industry = org["industries"][0] if org["industries"] else None

    size = org.get("estimated_num_employees")
    company_size = f"{size} employees" if size else None

    return EnrichmentResult(
        company_name=org.get("name") or company_name,
        domain=dom,
        industry=industry,
        company_size=company_size,
        geo=org.get("country"),
        personas=[{"title": "CTO"}],
        provider="apollo",
        confidence=0.85,
        raw={"apollo_id": org.get("id")},
    )


async def enrich_apollo_contact(
    *,
    email: str | None = None,
    domain: str | None = None,
    title: str | None = None,
    company_name: str | None = None,
) -> EnrichmentResult | None:
    """Apollo people search — contact-level enrichment when org search isn't enough."""
    api_key = (settings.apollo_api_key or "").strip()
    if not api_key:
        return None

    payload: dict = {"page": 1, "per_page": 1}
    if email and "@" in email:
        payload["q_keywords"] = email
    if domain:
        payload["q_organization_domains"] = domain.replace("https://", "").split("/")[0]
    elif company_name:
        payload["q_organization_name"] = company_name
    if title:
        payload["person_titles"] = [title]

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(
                "https://api.apollo.io/api/v1/mixed_people/search",
                headers={"Content-Type": "application/json", "X-Api-Key": api_key},
                json=payload,
            )
            if resp.status_code >= 400:
                logger.warning("Apollo contact search failed: %s %s", resp.status_code, resp.text[:200])
                return None
            data = resp.json()
    except Exception as exc:
        logger.warning("Apollo contact search error: %s", exc)
        return None

    people = data.get("people") or data.get("contacts") or []
    if not people:
        return None

    person = people[0]
    org = person.get("organization") or {}
    dom = org.get("primary_domain") or domain
    if isinstance(dom, str):
        dom = dom.replace("https://", "").replace("http://", "").split("/")[0] or None

    person_title = person.get("title") or title
    emails: list[str] = []
    if person.get("email"):
        emails.append(person["email"])
    elif email:
        emails.append(email)

    phones: list[str] = []
    if person.get("phone_numbers"):
        for p in person["phone_numbers"]:
            if isinstance(p, dict) and p.get("sanitized_number"):
                phones.append(p["sanitized_number"])
            elif isinstance(p, str):
                phones.append(p)

    personas = [{"title": person_title, "name": person.get("name")}] if person_title else []

    return EnrichmentResult(
        company_name=org.get("name") or company_name or "",
        domain=dom,
        industry=org.get("industry"),
        company_size=f"{org.get('estimated_num_employees')} employees" if org.get("estimated_num_employees") else None,
        geo=person.get("country") or org.get("country"),
        personas=personas,
        emails=emails,
        phones=phones,
        provider="apollo_contact",
        confidence=0.9,
        raw={"apollo_person_id": person.get("id"), "linkedin_url": person.get("linkedin_url")},
    )
