"""Rule-based lead discovery (T1 — no LLM required)."""

from __future__ import annotations

import csv
import io
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import Artifact, ArtifactType, DiscoveredAccount, Product

# Seed accounts per industry for lean/demo discovery (replace with enrichment API later)
INDUSTRY_SEEDS: dict[str, list[dict]] = {
    "fintech": [
        {"company_name": "NovaPay Systems", "domain": "novapay.example", "personas": [{"title": "CTO"}, {"title": "VP Engineering"}]},
        {"company_name": "LedgerFlow", "domain": "ledgerflow.example", "personas": [{"title": "Head of Platform"}]},
        {"company_name": "TrustBank Digital", "domain": "trustbank.example", "personas": [{"title": "CISO"}]},
    ],
    "healthtech": [
        {"company_name": "MedSync Health", "domain": "medsync.example", "personas": [{"title": "CTO"}, {"title": "CMIO"}]},
        {"company_name": "CarePath AI", "domain": "carepath.example", "personas": [{"title": "VP Product"}]},
        {"company_name": "VitalStream", "domain": "vitalstream.example", "personas": [{"title": "Director IT"}]},
    ],
    "saas": [
        {"company_name": "CloudOps Pro", "domain": "cloudops.example", "personas": [{"title": "CTO"}]},
        {"company_name": "DevStack Inc", "domain": "devstack.example", "personas": [{"title": "VP Engineering"}]},
    ],
    "devtools": [
        {"company_name": "ShipFast Labs", "domain": "shipfast.example", "personas": [{"title": "CTO"}, {"title": "Staff Engineer"}]},
        {"company_name": "CodeForge", "domain": "codeforge.example", "personas": [{"title": "Head of Developer Experience"}]},
    ],
}


def _normalize_industry(name: str) -> str:
    return name.strip().lower().replace(" ", "").replace("-", "")


def _match_seed_key(industry: str) -> str | None:
    key = _normalize_industry(industry)
    for seed_key in INDUSTRY_SEEDS:
        if seed_key in key or key in seed_key:
            return seed_key
    if "fin" in key:
        return "fintech"
    if "health" in key or "med" in key:
        return "healthtech"
    if "dev" in key or "tool" in key:
        return "devtools"
    return "saas"


async def _latest_strategy(db: AsyncSession, product_id: uuid.UUID, tenant_id: uuid.UUID) -> dict | None:
    result = await db.execute(
        select(Artifact)
        .where(
            Artifact.product_id == product_id,
            Artifact.tenant_id == tenant_id,
            Artifact.artifact_type.in_([ArtifactType.STRATEGY, ArtifactType.MARKET_RESEARCH]),
        )
        .order_by(Artifact.created_at.desc())
        .limit(1)
    )
    artifact = result.scalar_one_or_none()
    if artifact and artifact.metadata_:
        return artifact.metadata_
    return None


def _industries_from_input(
    focus_industries: list[str] | None,
    strategy: dict | None,
    profile: dict | None,
) -> list[str]:
    if focus_industries:
        return focus_industries
    if strategy:
        icp = strategy.get("icp") or strategy.get("target_industries") or ""
        if isinstance(icp, list):
            return icp
        if isinstance(icp, str) and icp.strip():
            return [icp]
    if profile:
        industries = profile.get("industries") or profile.get("target_industries")
        if isinstance(industries, list) and industries:
            return industries
    return ["saas", "devtools"]


def parse_csv_accounts(csv_text: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(csv_text.strip()))
    rows = []
    for row in reader:
        name = (row.get("company_name") or row.get("company") or row.get("name") or "").strip()
        if not name:
            continue
        rows.append({
            "company_name": name,
            "domain": (row.get("domain") or row.get("website") or "").strip() or None,
            "industry": (row.get("industry") or "").strip() or None,
            "company_size": (row.get("company_size") or row.get("size") or "").strip() or None,
            "geo": (row.get("geo") or row.get("region") or "").strip() or None,
            "personas": [{"title": row.get("title", "CTO")}] if row.get("title") else [{"title": "CTO"}],
        })
    return rows


async def discover_leads(
    db: AsyncSession,
    product: Product,
    tenant_id: uuid.UUID,
    *,
    focus_industries: list[str] | None = None,
    max_leads: int = 50,
    csv_import: str | None = None,
    geo: str | None = None,
) -> dict:
    """Discover accounts via rules + optional CSV — no LLM."""
    strategy = await _latest_strategy(db, product.id, tenant_id)
    industries = _industries_from_input(focus_industries, strategy, product.profile)

    candidates: list[dict] = []
    if csv_import:
        candidates.extend(parse_csv_accounts(csv_import))

    for industry in industries:
        seed_key = _match_seed_key(industry)
        for seed in INDUSTRY_SEEDS.get(seed_key, INDUSTRY_SEEDS["saas"]):
            candidates.append({
                **seed,
                "industry": industry,
                "source": "rules",
            })

    seen: set[str] = set()
    created: list[DiscoveredAccount] = []
    for item in candidates:
        if len(created) >= max_leads:
            break
        key = (item.get("domain") or item["company_name"]).lower()
        if key in seen:
            continue
        seen.add(key)

        account = DiscoveredAccount(
            product_id=product.id,
            tenant_id=tenant_id,
            company_name=item["company_name"],
            domain=item.get("domain"),
            industry=item.get("industry"),
            company_size=item.get("company_size"),
            geo=geo or item.get("geo"),
            personas=item.get("personas", [{"title": "CTO"}]),
            source=item.get("source", "rules"),
            status="new",
        )
        db.add(account)
        created.append(account)

    await db.flush()
    return {
        "discovered_count": len(created),
        "industries_used": industries,
        "accounts": [
            {
                "id": str(a.id),
                "company_name": a.company_name,
                "domain": a.domain,
                "industry": a.industry,
                "personas": a.personas,
                "source": a.source,
            }
            for a in created
        ],
    }


async def list_discovered_accounts(
    db: AsyncSession,
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
    limit: int = 100,
) -> list[DiscoveredAccount]:
    result = await db.execute(
        select(DiscoveredAccount)
        .where(
            DiscoveredAccount.product_id == product_id,
            DiscoveredAccount.tenant_id == tenant_id,
        )
        .order_by(DiscoveredAccount.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
