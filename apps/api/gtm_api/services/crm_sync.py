"""External CRM sync — optional, off by default in minimal profile."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.config import get_settings
from gtm_api.services.crm import list_opportunities, opportunity_to_dict

settings = get_settings()


async def sync_opportunities_to_external(
    db: AsyncSession,
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> dict:
    """Stub sync — returns local snapshot when external CRM is disabled."""
    if not settings.external_crm_sync_enabled:
        return {
            "synced": False,
            "reason": "External CRM sync disabled (minimal profile or ENABLE_EXTERNAL_CRM_SYNC=false)",
            "provider": settings.external_crm_provider or None,
        }

    opps = await list_opportunities(db, product_id, tenant_id, limit=200)
    # Placeholder for HubSpot/Salesforce integration
    return {
        "synced": True,
        "provider": settings.external_crm_provider or "stub",
        "opportunities_exported": len(opps),
        "records": [opportunity_to_dict(o) for o in opps[:10]],
        "note": "Stub export — wire real CRM API when provider credentials are configured",
    }


def sync_status() -> dict:
    return {
        "enabled": settings.external_crm_sync_enabled,
        "provider": settings.external_crm_provider or None,
        "deployment_profile": settings.deployment_profile,
    }
