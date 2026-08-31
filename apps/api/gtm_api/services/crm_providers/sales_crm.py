"""Sales CRM microservice bridge."""

from __future__ import annotations

import logging
import uuid
from typing import Any

import httpx

from gtm_api.config import get_settings
from gtm_api.models import Lead, Opportunity

logger = logging.getLogger(__name__)
settings = get_settings()


def _base_url() -> str | None:
    url = (settings.sales_crm_url or "").strip().rstrip("/")
    return url or None


async def push_lead(lead: Lead, *, campaign: str = "aurora") -> dict[str, Any]:
    base = _base_url()
    if not base:
        return {"synced": False, "reason": "SALES_CRM_URL not configured"}

    payload = {
        "name": lead.name or lead.email or lead.company or "Inbound lead",
        "company": lead.company or "",
        "email": lead.email or "",
        "phone": (lead.metadata_ or {}).get("phone", ""),
        "source": lead.source,
        "campaign": campaign,
        "score": lead.score,
    }
    headers = {"Content-Type": "application/json"}
    if settings.sales_crm_api_key:
        headers["X-API-Key"] = settings.sales_crm_api_key

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(f"{base}/api/leads", json=payload, headers=headers)
            if resp.status_code >= 400:
                return {"synced": False, "status": resp.status_code, "body": resp.text[:300]}
            return {"synced": True, "provider": "sales_crm", "response": resp.json()}
    except Exception as exc:
        logger.warning("sales-crm push failed: %s", exc)
        return {"synced": False, "error": str(exc)}


async def push_opportunity(opp: Opportunity) -> dict[str, Any]:
    base = _base_url()
    if not base:
        return {"synced": False, "reason": "SALES_CRM_URL not configured"}

    payload = {
        "name": opp.name,
        "company": opp.company or "",
        "email": "",
        "source": "aurora_opportunity",
        "campaign": opp.stage,
        "score": int((opp.probability or 0) * 100),
    }
    headers = {"Content-Type": "application/json"}
    if settings.sales_crm_api_key:
        headers["X-API-Key"] = settings.sales_crm_api_key

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(f"{base}/api/leads", json=payload, headers=headers)
            if resp.status_code >= 400:
                return {"synced": False, "status": resp.status_code, "body": resp.text[:300]}
            return {"synced": True, "provider": "sales_crm", "opportunity_id": str(opp.id), "response": resp.json()}
    except Exception as exc:
        logger.warning("sales-crm opportunity push failed: %s", exc)
        return {"synced": False, "error": str(exc)}
