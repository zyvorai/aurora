"""Rule-based lead qualification (T0 — instant scoring, no LLM)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import Artifact, ArtifactType, DiscoveredAccount, Lead, LeadScoreRecord, Product

TIER_THRESHOLDS = {"A": 75, "B": 50, "C": 0}


def score_to_tier(score: float) -> str:
    if score >= TIER_THRESHOLDS["A"]:
        return "A"
    if score >= TIER_THRESHOLDS["B"]:
        return "B"
    return "C"


def score_account(
    account: DiscoveredAccount,
    *,
    target_industries: list[str] | None = None,
    target_personas: list[str] | None = None,
) -> tuple[float, dict]:
    """Deterministic score 0–100 from firmographics + persona fit."""
    factors: dict[str, float] = {}
    score = 40.0  # base

    if account.domain:
        factors["has_domain"] = 10
        score += 10

    if account.industry and target_industries:
        ind_lower = account.industry.lower()
        if any(t.lower() in ind_lower or ind_lower in t.lower() for t in target_industries):
            factors["industry_match"] = 25
            score += 25
        else:
            factors["industry_partial"] = 5
            score += 5
    elif account.industry:
        factors["industry_present"] = 10
        score += 10

    personas = account.personas or []
    titles = [p.get("title", "").lower() for p in personas if isinstance(p, dict)]
    target = [p.lower() for p in (target_personas or ["cto", "vp engineering", "head of platform"])]
    if any(any(t in title for t in target) for title in titles):
        factors["persona_match"] = 20
        score += 20

    if account.company_size:
        size = account.company_size.lower()
        if any(s in size for s in ("200", "500", "1000", "enterprise", "mid")):
            factors["company_size_fit"] = 10
            score += 10

    if account.source == "csv":
        factors["imported_lead"] = 5
        score += 5

    return min(score, 100.0), factors


async def _strategy_context(db: AsyncSession, product_id: uuid.UUID, tenant_id: uuid.UUID) -> dict:
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
    return artifact.metadata_ if artifact and artifact.metadata_ else {}


async def qualify_leads(
    db: AsyncSession,
    product: Product,
    tenant_id: uuid.UUID,
    *,
    account_ids: list[uuid.UUID] | None = None,
    focus_industries: list[str] | None = None,
) -> dict:
    """Score discovered accounts and optionally promote A-tier to Lead records."""
    strategy = await _strategy_context(db, product.id, tenant_id)
    target_industries = focus_industries or []
    if not target_industries and strategy.get("icp"):
        icp = strategy["icp"]
        if isinstance(icp, str):
            target_industries = [icp]

    personas_raw = strategy.get("personas") or []
    target_personas = [
        p.get("title", "") for p in personas_raw if isinstance(p, dict) and p.get("title")
    ]

    query = select(DiscoveredAccount).where(
        DiscoveredAccount.product_id == product.id,
        DiscoveredAccount.tenant_id == tenant_id,
    )
    if account_ids:
        query = query.where(DiscoveredAccount.id.in_(account_ids))

    result = await db.execute(query.order_by(DiscoveredAccount.created_at.desc()))
    accounts = list(result.scalars().all())

    scored: list[dict] = []
    for account in accounts:
        score, factors = score_account(
            account,
            target_industries=target_industries,
            target_personas=target_personas,
        )
        tier = score_to_tier(score)
        record = LeadScoreRecord(
            product_id=product.id,
            tenant_id=tenant_id,
            discovered_account_id=account.id,
            score=score,
            tier=tier,
            factors=factors,
            explanation=_explain(factors, tier),
        )
        db.add(record)

        if tier == "A":
            lead = Lead(
                product_id=product.id,
                tenant_id=tenant_id,
                company=account.company_name,
                score=score,
                stage="qualified",
                source="discovery",
                metadata_={"discovered_account_id": str(account.id), "domain": account.domain},
            )
            db.add(lead)
            account.status = "qualified"

        scored.append({
            "account_id": str(account.id),
            "company_name": account.company_name,
            "score": score,
            "tier": tier,
            "factors": factors,
            "explanation": record.explanation,
        })

    await db.flush()
    scored.sort(key=lambda x: x["score"], reverse=True)
    return {
        "qualified_count": len(scored),
        "tier_a": sum(1 for s in scored if s["tier"] == "A"),
        "tier_b": sum(1 for s in scored if s["tier"] == "B"),
        "leads": scored,
    }


def _explain(factors: dict, tier: str) -> str:
    parts = [f"Tier {tier}:"]
    if factors.get("industry_match"):
        parts.append("strong ICP industry fit")
    if factors.get("persona_match"):
        parts.append("target persona identified")
    if factors.get("has_domain"):
        parts.append("company domain known")
    return " ".join(parts)


async def list_scored_leads(
    db: AsyncSession,
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
    limit: int = 100,
) -> list[dict]:
    result = await db.execute(
        select(LeadScoreRecord, DiscoveredAccount)
        .join(DiscoveredAccount, LeadScoreRecord.discovered_account_id == DiscoveredAccount.id)
        .where(
            LeadScoreRecord.product_id == product_id,
            LeadScoreRecord.tenant_id == tenant_id,
        )
        .order_by(LeadScoreRecord.score.desc())
        .limit(limit)
    )
    rows = []
    for score_rec, account in result.all():
        rows.append({
            "score_id": str(score_rec.id),
            "account_id": str(account.id),
            "company_name": account.company_name,
            "domain": account.domain,
            "industry": account.industry,
            "score": score_rec.score,
            "tier": score_rec.tier,
            "explanation": score_rec.explanation,
            "factors": score_rec.factors,
        })
    return rows
