"""External CRM sync — sales-crm, HubSpot, or stub export."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.config import get_settings
from gtm_api.models import Lead
from gtm_api.services.crm import list_opportunities, opportunity_to_dict
from gtm_api.services.crm_providers import hubspot, sales_crm

settings = get_settings()


async def sync_lead_to_external(lead: Lead) -> dict[str, Any]:
    """Push a single lead to the configured external CRM."""
    if not settings.external_crm_sync_enabled:
        return {"synced": False, "reason": "External CRM sync disabled"}

    provider = (settings.external_crm_provider or "sales_crm").lower()
    if provider == "hubspot":
        return await hubspot.push_lead(lead)
    if provider in ("sales_crm", "sales-crm", "salescrm"):
        return await sales_crm.push_lead(lead)
    return {"synced": False, "reason": f"Unknown provider: {provider}"}


async def sync_opportunities_to_external(
    db: AsyncSession,
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> dict:
    """Export opportunities to the configured external CRM."""
    if not settings.external_crm_sync_enabled:
        return {
            "synced": False,
            "reason": "External CRM sync disabled (ENABLE_EXTERNAL_CRM_SYNC=false)",
            "provider": settings.external_crm_provider or None,
        }

    opps = await list_opportunities(db, product_id, tenant_id, limit=200)
    provider = (settings.external_crm_provider or "sales_crm").lower()
    results: list[dict] = []

    for opp in opps:
        if provider == "hubspot":
            results.append(await hubspot.push_opportunity(opp))
        elif provider in ("sales_crm", "sales-crm", "salescrm"):
            results.append(await sales_crm.push_opportunity(opp))
        else:
            results.append({"synced": False, "reason": f"Unknown provider: {provider}"})

    synced = sum(1 for r in results if r.get("synced"))
    return {
        "synced": synced > 0,
        "provider": provider,
        "opportunities_exported": len(opps),
        "synced_count": synced,
        "results": results[:20],
    }


def sync_status() -> dict:
    return {
        "enabled": settings.external_crm_sync_enabled,
        "provider": settings.external_crm_provider or None,
        "deployment_profile": settings.deployment_profile,
        "enrichment_enabled": settings.enrichment_enabled,
        "apollo_configured": bool(settings.apollo_api_key),
        "sales_crm_configured": bool(settings.sales_crm_url),
        "hubspot_configured": bool(settings.hubspot_access_token),
    }
