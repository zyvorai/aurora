"""HubSpot CRM sync — contacts + deals."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from gtm_api.config import get_settings
from gtm_api.models import Lead, Opportunity

logger = logging.getLogger(__name__)
settings = get_settings()
HUBSPOT_BASE = "https://api.hubapi.com"


def _token() -> str | None:
    token = (settings.hubspot_access_token or "").strip()
    return token or None


async def push_lead(lead: Lead) -> dict[str, Any]:
    token = _token()
    if not token:
        return {"synced": False, "reason": "HUBSPOT_ACCESS_TOKEN not configured"}

    properties = {
        "email": lead.email or f"noemail+{lead.id}@aurora.local",
        "firstname": (lead.name or "").split()[0] if lead.name else "",
        "lastname": " ".join((lead.name or "").split()[1:]) if lead.name and " " in lead.name else "",
        "company": lead.company or "",
        "jobtitle": lead.title or "",
    }
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{HUBSPOT_BASE}/crm/v3/objects/contacts",
                headers=headers,
                json={"properties": properties},
            )
            if resp.status_code >= 400:
                return {"synced": False, "status": resp.status_code, "body": resp.text[:300]}
            data = resp.json()
            return {"synced": True, "provider": "hubspot", "contact_id": data.get("id")}
    except Exception as exc:
        logger.warning("HubSpot lead push failed: %s", exc)
        return {"synced": False, "error": str(exc)}


async def push_opportunity(opp: Opportunity) -> dict[str, Any]:
    token = _token()
    if not token:
        return {"synced": False, "reason": "HUBSPOT_ACCESS_TOKEN not configured"}

    properties = {
        "dealname": opp.name,
        "dealstage": _map_stage(opp.stage),
        "amount": str(opp.amount or 0),
    }
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{HUBSPOT_BASE}/crm/v3/objects/deals",
                headers=headers,
                json={"properties": properties},
            )
            if resp.status_code >= 400:
                return {"synced": False, "status": resp.status_code, "body": resp.text[:300]}
            data = resp.json()
            return {"synced": True, "provider": "hubspot", "deal_id": data.get("id")}
    except Exception as exc:
        logger.warning("HubSpot deal push failed: %s", exc)
        return {"synced": False, "error": str(exc)}


def _map_stage(stage: str) -> str:
    mapping = {
        "discovery": "appointmentscheduled",
        "qualification": "qualifiedtobuy",
        "technical_eval": "presentationscheduled",
        "proposal": "decisionmakerboughtin",
        "negotiation": "contractsent",
        "closed_won": "closedwon",
        "closed_lost": "closedlost",
    }
    return mapping.get(stage, "appointmentscheduled")
