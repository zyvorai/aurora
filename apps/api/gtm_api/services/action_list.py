"""Daily action list: what needs a person's attention across deals and drafts.

Derived from existing state only (no new tables). Items are grouped per deal / per kind so a
long list does not drown the few that matter, and ordered by how much customer risk they carry.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import (
    ApprovalStatus,
    Artifact,
    Opportunity,
    OpportunityActivity,
    Product,
    Requirement,
    RequirementProof,
)

CLOSED_STAGES = ("closed_won", "closed_lost")
FOLLOW_UP_AFTER_DAYS = 7  # no recorded activity on an open deal for this long => follow-up due

# Lower number = shown first. Stale items put existing customer commitments at risk.
KIND_ORDER = {
    "stale_proof": 0,
    "stale_artifact": 1,
    "proof_review": 2,
    "needs_answer": 3,
    "artifact_review": 4,
    "follow_up": 5,
}


@dataclass
class ActionItem:
    id: str
    kind: str
    title: str
    detail: str
    product_id: uuid.UUID
    product_name: str
    href: str
    count: int = 1
    opportunity_id: uuid.UUID | None = None
    artifact_id: uuid.UUID | None = None
    age_days: int = 0


def _age(now: datetime, then: datetime | None) -> int:
    return max((now - then).days, 0) if then else 0


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


async def build_action_list(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    now: datetime,
    product_id: uuid.UUID | None = None,
) -> list[ActionItem]:
    opp_q = (
        select(Opportunity, Product.name)
        .join(Product, Product.id == Opportunity.product_id)
        .where(Opportunity.tenant_id == tenant_id, Opportunity.stage.notin_(CLOSED_STAGES))
    )
    art_q = (
        select(Artifact, Product.name)
        .join(Product, Product.id == Artifact.product_id)
        .where(
            Artifact.tenant_id == tenant_id,
            (Artifact.status == ApprovalStatus.PENDING) | Artifact.stale_reason.is_not(None),
        )
    )
    if product_id:
        opp_q = opp_q.where(Opportunity.product_id == product_id)
        art_q = art_q.where(Artifact.product_id == product_id)

    opps = (await db.execute(opp_q)).all()
    items: list[ActionItem] = []

    if opps:
        opp_ids = [o.id for o, _ in opps]
        reqs = (
            await db.execute(select(Requirement).where(Requirement.opportunity_id.in_(opp_ids)))
        ).scalars().all()
        latest: dict[uuid.UUID, RequirementProof] = {}
        if reqs:
            proofs = (
                await db.execute(
                    select(RequirementProof)
                    .where(RequirementProof.requirement_id.in_([r.id for r in reqs]))
                    .order_by(RequirementProof.created_at.desc())
                )
            ).scalars().all()
            for p in proofs:
                latest.setdefault(p.requirement_id, p)
        reqs_by_opp: dict[uuid.UUID, list[Requirement]] = {}
        for r in reqs:
            reqs_by_opp.setdefault(r.opportunity_id, []).append(r)

        last_activity = dict(
            (
                await db.execute(
                    select(
                        OpportunityActivity.opportunity_id, func.max(OpportunityActivity.created_at)
                    )
                    .where(OpportunityActivity.opportunity_id.in_(opp_ids))
                    .group_by(OpportunityActivity.opportunity_id)
                )
            ).all()
        )

        for opp, product_name in opps:
            href = f"/products/{opp.product_id}/deals/{opp.id}"
            base = {
                "product_id": opp.product_id, "product_name": product_name,
                "opportunity_id": opp.id, "href": href,
            }
            mine = reqs_by_opp.get(opp.id, [])
            proofs_here = [(r, latest.get(r.id)) for r in mine]

            stale = [p for _, p in proofs_here if p and p.stale_reason]
            if stale:
                items.append(ActionItem(
                    id=f"stale_proof:{opp.id}", kind="stale_proof", count=len(stale),
                    title=f"{opp.name}: {_plural(len(stale), 'answer')} out of date",
                    detail="Source documentation changed after these were written. Re-analyze before sending.",
                    age_days=_age(now, min(p.created_at for p in stale)), **base,
                ))
            pending = [
                p for _, p in proofs_here
                if p and p.review_status == "pending" and not p.stale_reason
            ]
            if pending:
                items.append(ActionItem(
                    id=f"proof_review:{opp.id}", kind="proof_review", count=len(pending),
                    title=f"{opp.name}: {_plural(len(pending), 'proof')} awaiting review",
                    detail="Check the cited evidence, then approve or reject.",
                    age_days=_age(now, min(p.created_at for p in pending)), **base,
                ))
            open_reqs = [
                r for r, p in proofs_here if p is None or p.verdict in ("gap", "unknown")
            ]
            if open_reqs:
                items.append(ActionItem(
                    id=f"needs_answer:{opp.id}", kind="needs_answer", count=len(open_reqs),
                    title=f"{opp.name}: {_plural(len(open_reqs), 'requirement')} without an answer",
                    detail="No documented evidence yet. Analyze, or get an answer from engineering.",
                    age_days=_age(now, min(r.created_at for r in open_reqs)), **base,
                ))

            since = last_activity.get(opp.id) or opp.created_at
            idle = _age(now, since)
            if idle >= FOLLOW_UP_AFTER_DAYS:
                items.append(ActionItem(
                    id=f"follow_up:{opp.id}", kind="follow_up",
                    title=f"{opp.name}: no activity for {idle} days",
                    detail=f"Open deal in {opp.stage.replace('_', ' ')}. Log a touchpoint or move the stage.",
                    age_days=idle, **base,
                ))

    for artifact, product_name in (await db.execute(art_q)).all():
        base = {
            "product_id": artifact.product_id, "product_name": product_name,
            "artifact_id": artifact.id, "href": f"/products/{artifact.product_id}?tab=publish",
            "age_days": _age(now, artifact.stale_since or artifact.created_at),
        }
        label = artifact.title or artifact.artifact_type.value
        if artifact.stale_reason:
            unverified = artifact.stale_reason.endswith("unverified")
            items.append(ActionItem(
                id=f"stale_artifact:{artifact.id}", kind="stale_artifact",
                title=f"{label}: claims may be out of date",
                detail=(
                    "A source changed and this draft has no recorded citations to check."
                    if unverified
                    else "A source this draft cited has changed. Re-review before publishing."
                ),
                **base,
            ))
        else:
            items.append(ActionItem(
                id=f"artifact_review:{artifact.id}", kind="artifact_review",
                title=f"{label}: waiting for approval",
                detail="Pending review.", **base,
            ))

    items.sort(key=lambda i: (KIND_ORDER[i.kind], -i.age_days, i.title))
    return items
