"""Inbound lead orchestration — enrich, score, assign, sync."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.config import get_settings
from gtm_api.models import Lead, PortalAccountStatus, Product, SalesPersonAccount
from gtm_api.services.attribution import record_touchpoint
from gtm_api.services.crm_sync import sync_lead_to_external
from gtm_api.services.enrichment.waterfall import enrich_contact
from gtm_api.services.lead_qualification import score_account
from gtm_api.models import DiscoveredAccount

settings = get_settings()


async def _next_salesperson_id(db: AsyncSession, tenant_id: uuid.UUID) -> uuid.UUID | None:
    result = await db.execute(
        select(SalesPersonAccount)
        .where(
            SalesPersonAccount.tenant_id == tenant_id,
            SalesPersonAccount.status == PortalAccountStatus.APPROVED,
            SalesPersonAccount.is_active.is_(True),
        )
        .order_by(SalesPersonAccount.created_at.asc())
    )
    reps = list(result.scalars().all())
    if not reps:
        return None

    count_result = await db.execute(
        select(func.count(Lead.id)).where(Lead.tenant_id == tenant_id, Lead.source == "inbound")
    )
    count = count_result.scalar() or 0
    return reps[count % len(reps)].id


async def ingest_inbound_lead(
    db: AsyncSession,
    product: Product,
    tenant_id: uuid.UUID,
    *,
    email: str,
    name: str | None = None,
    company: str | None = None,
    phone: str | None = None,
    title: str | None = None,
    domain: str | None = None,
    utm_source: str | None = None,
    utm_campaign: str | None = None,
    utm_medium: str | None = None,
) -> dict:
    """Default-style inbound: enrich → score → assign → optional CRM push."""
    inferred_domain = domain or (email.split("@")[-1] if "@" in email else None)
    enrichment = await enrich_contact(
        email=email,
        domain=inferred_domain,
        title=title,
        company_name=company,
    )
    company_name = company or enrichment.company_name or (email.split("@")[-1] if "@" in email else "Unknown")
    if not title and enrichment.personas:
        title = enrichment.personas[0].get("title")

    # Score using a synthetic discovered account for consistent rules
    account = DiscoveredAccount(
        product_id=product.id,
        tenant_id=tenant_id,
        company_name=company_name,
        domain=enrichment.domain or domain,
        industry=enrichment.industry,
        company_size=enrichment.company_size,
        personas=[{"title": title or "CTO"}],
        source="inbound",
    )
    score, factors = score_account(account)

    assignee_id = await _next_salesperson_id(db, tenant_id)

    lead = Lead(
        product_id=product.id,
        tenant_id=tenant_id,
        email=email.strip().lower(),
        name=name,
        company=company_name,
        title=title,
        score=score,
        stage="new" if score < 50 else "qualified",
        source="inbound",
        assigned_sales_person_id=assignee_id,
        metadata_={
            "phone": phone or (enrichment.phones[0] if enrichment.phones else None),
            "enrichment_provider": enrichment.provider,
            "enrichment_emails": enrichment.emails,
            "factors": factors,
            "ingested_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    db.add(lead)
    await db.flush()

    await record_touchpoint(
        db,
        tenant_id,
        product.id,
        touch_type="inbound_form",
        channel=utm_medium or "web",
        campaign=utm_campaign,
        source=utm_source,
        lead_id=str(lead.id),
        email=email,
    )

    crm_result = {"synced": False}
    if settings.external_crm_sync_enabled:
        crm_result = await sync_lead_to_external(lead)

    return {
        "lead_id": str(lead.id),
        "score": score,
        "stage": lead.stage,
        "assigned_sales_person_id": str(assignee_id) if assignee_id else None,
        "enrichment_provider": enrichment.provider,
        "crm_sync": crm_result,
    }
