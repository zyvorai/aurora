"""Deal workspace: customer requirements mapped to evidence-backed proofs."""

import re
import uuid
from collections import Counter
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import content_hash, get_current_user, require_permission
from gtm_api.database import get_db
from gtm_api.models import (
    PROOF_VERDICTS,
    ApprovalStatus,
    Artifact,
    ArtifactType,
    Requirement,
    RequirementProof,
    User,
)
from gtm_api.schemas import (
    ActionItemResponse,
    ActionListResponse,
    DealWorkspaceResponse,
    OpportunityResponse,
    ProofResponse,
    ProofReviewRequest,
    RequirementAnalyzeRequest,
    RequirementCreateRequest,
    RequirementResponse,
    RequirementResponseDocument,
    RequirementUploadResponse,
)
from gtm_api.services.action_list import FOLLOW_UP_AFTER_DAYS, build_action_list
from gtm_api.services.artifact_provenance import documents_for_citations, record_dependencies
from gtm_api.services.crm import get_opportunity
from gtm_api.services.embeddings import embedding_service
from gtm_api.services.requirements import (
    MAX_UPLOAD_BYTES,
    assess_requirement,
    build_response_document,
    extract_requirements,
    extract_requirements_with_info,
    extract_text_from_upload,
)
from gtm_api.services.vector_store import vector_store
from gtm_api.tenant import audit_log, get_product_for_tenant, get_tenant_context

router = APIRouter(tags=["deals"])

_BASE = "/products/{product_id}/opportunities/{opportunity_id}"
_RETRIEVAL_LIMIT = 6


async def _load_opportunity(db, ctx, product_id, opportunity_id):
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    opp = await get_opportunity(db, opportunity_id, ctx.tenant_id)
    if not opp or opp.product_id != product_id:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return opp


async def _requirements_with_proofs(db, tenant_id, opportunity_id):
    reqs = (
        await db.execute(
            select(Requirement)
            .where(Requirement.tenant_id == tenant_id, Requirement.opportunity_id == opportunity_id)
            .order_by(Requirement.position, Requirement.created_at)
        )
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
            latest.setdefault(p.requirement_id, p)  # newest first
    return reqs, latest


def _proof_out(p: RequirementProof | None) -> ProofResponse | None:
    if p is None:
        return None
    return ProofResponse(
        id=p.id, verdict=p.verdict, answer=p.answer, conditions=p.conditions,
        validation_test=p.validation_test, citations=p.citations or [], claims=p.claims or [],
        confidence=p.confidence, review_status=p.review_status, reviewer_id=p.reviewer_id,
        review_comment=p.review_comment, stale_reason=p.stale_reason, created_at=p.created_at,
    )


def _summarise(reqs, latest) -> tuple[dict[str, int], list[str]]:
    verdicts = Counter(latest[r.id].verdict if r.id in latest else "unanalyzed" for r in reqs)
    summary = {v: verdicts.get(v, 0) for v in (*PROOF_VERDICTS, "unanalyzed")}
    summary["total"] = len(reqs)
    summary["approved"] = sum(
        1 for p in latest.values() if p.review_status == "approved" and not p.stale_reason
    )
    summary["stale"] = sum(1 for p in latest.values() if p.stale_reason)
    actions = []
    if summary["unanalyzed"]:
        actions.append(f"Analyze {summary['unanalyzed']} requirement(s) that have no evidence yet")
    if summary["stale"]:
        actions.append(f"Re-analyze {summary['stale']} proof(s) whose source documents changed")
    pending = sum(
        1 for p in latest.values() if p.review_status == "pending" and not p.stale_reason
    )
    if pending:
        actions.append(f"Review {pending} proof(s) awaiting approval")
    gaps = summary["gap"] + summary["unknown"]
    if gaps:
        actions.append(f"Find answers for {gaps} gap/unknown requirement(s)")
    if summary["roadmap"]:
        actions.append(f"Confirm customer expectations for {summary['roadmap']} roadmap item(s)")
    return summary, actions


def _norm(text: str) -> str:
    return re.sub(r"\W+", " ", text.lower()).strip()


async def _store_requirements(
    db, ctx, user, product_id, opportunity_id, texts: list[str], source: str
) -> tuple[list[Requirement], int]:
    """Insert new requirements after the opportunity's existing ones; skip exact repeats
    (e.g. the same RFP uploaded twice). Returns (created, skipped_duplicates)."""
    existing = (
        await db.execute(
            select(Requirement.text, Requirement.position).where(
                Requirement.tenant_id == ctx.tenant_id, Requirement.opportunity_id == opportunity_id
            )
        )
    ).all()
    seen = {_norm(t) for t, _ in existing}
    start = max((pos for _, pos in existing), default=-1) + 1

    fresh = []
    for t in texts:
        if _norm(t) not in seen:
            seen.add(_norm(t))
            fresh.append(t)
    rows = [
        Requirement(
            tenant_id=ctx.tenant_id, product_id=product_id, opportunity_id=opportunity_id,
            text=t, position=start + i, source=source,
        )
        for i, t in enumerate(fresh)
    ]
    db.add_all(rows)
    await audit_log(db, ctx.tenant_id, user.id, "requirements_added", "opportunity", str(opportunity_id))
    await db.commit()
    return rows, len(texts) - len(fresh)


def _req_out(r: Requirement) -> RequirementResponse:
    return RequirementResponse(id=r.id, text=r.text, position=r.position, source=r.source)


@router.post(f"{_BASE}/requirements", response_model=list[RequirementResponse])
async def add_requirements(
    product_id: uuid.UUID,
    opportunity_id: uuid.UUID,
    req: RequirementCreateRequest,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await _load_opportunity(db, ctx, product_id, opportunity_id)
    texts = await extract_requirements(req.text)
    if not texts:
        raise HTTPException(status_code=400, detail="No requirements found in the text")
    rows, _ = await _store_requirements(db, ctx, user, product_id, opportunity_id, texts, req.source)
    return [_req_out(r) for r in rows]


@router.post(f"{_BASE}/requirements/upload", response_model=RequirementUploadResponse)
async def upload_requirements(
    product_id: uuid.UUID,
    opportunity_id: uuid.UUID,
    file: UploadFile = File(...),
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    """Extract requirements from an uploaded RFP or questionnaire (txt, md, pdf, docx, pptx,
    csv, xlsx). The file itself is not stored; only the extracted requirements are."""
    ctx = await get_tenant_context(user, db)
    await _load_opportunity(db, ctx, product_id, opportunity_id)

    filename = file.filename or "upload"
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413, detail=f"File is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB"
        )
    try:
        text = extract_text_from_upload(filename, file.content_type, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read {filename}: {exc}") from exc

    texts, truncated = await extract_requirements_with_info(text)
    if not texts:
        raise HTTPException(status_code=400, detail=f"No requirements found in {filename}")
    rows, skipped = await _store_requirements(
        db, ctx, user, product_id, opportunity_id, texts, f"upload:{filename}"[:255]
    )
    return RequirementUploadResponse(
        filename=filename, requirements=[_req_out(r) for r in rows],
        skipped_duplicates=skipped, truncated=truncated,
    )


@router.post(f"{_BASE}/requirements/analyze", response_model=DealWorkspaceResponse)
async def analyze_requirements(
    product_id: uuid.UUID,
    opportunity_id: uuid.UUID,
    req: RequirementAnalyzeRequest = RequirementAnalyzeRequest(),
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    opp = await _load_opportunity(db, ctx, product_id, opportunity_id)
    reqs, latest = await _requirements_with_proofs(db, ctx.tenant_id, opportunity_id)

    if req.requirement_ids is not None:
        wanted = set(req.requirement_ids)
        targets = [r for r in reqs if r.id in wanted]
    else:
        targets = [r for r in reqs if r.id not in latest or latest[r.id].stale_reason]

    for r in targets:
        vector = await embedding_service.embed_query(r.text)
        results = await vector_store.search(ctx.tenant_id, product_id, vector, limit=_RETRIEVAL_LIMIT)
        draft = await assess_requirement(r.text, results)
        docs = await documents_for_citations(db, ctx.tenant_id, draft.citations)
        proof = RequirementProof(
            tenant_id=ctx.tenant_id, requirement_id=r.id, verdict=draft.verdict, answer=draft.answer,
            conditions=draft.conditions or None, validation_test=draft.validation_test or None,
            citations=draft.citations, claims=draft.claims, confidence=draft.confidence,
            source_versions=[
                {"document_id": str(d.id), "url": d.url, "content_hash": d.content_hash} for d in docs
            ],
        )
        db.add(proof)
        latest[r.id] = proof

    await audit_log(db, ctx.tenant_id, user.id, "requirements_analyzed", "opportunity", str(opportunity_id))
    await db.commit()
    return _workspace(opp, reqs, latest)


def _workspace(opp, reqs, latest) -> DealWorkspaceResponse:
    summary, actions = _summarise(reqs, latest)
    return DealWorkspaceResponse(
        opportunity=OpportunityResponse(
            id=opp.id, name=opp.name, company=opp.company, stage=opp.stage, amount=opp.amount,
            probability=opp.probability, lead_id=opp.lead_id,
            proposal_artifact_id=opp.proposal_artifact_id,
            architect_artifact_id=opp.architect_artifact_id, metadata=opp.metadata_ or {},
            created_at=opp.created_at, updated_at=opp.updated_at,
        ),
        requirements=[
            RequirementResponse(
                id=r.id, text=r.text, position=r.position, source=r.source,
                owner_user_id=r.owner_user_id, proof=_proof_out(latest.get(r.id)),
            )
            for r in reqs
        ],
        summary=summary,
        next_actions=actions,
    )


@router.get(f"{_BASE}/workspace", response_model=DealWorkspaceResponse)
async def deal_workspace(
    product_id: uuid.UUID,
    opportunity_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    opp = await _load_opportunity(db, ctx, product_id, opportunity_id)
    reqs, latest = await _requirements_with_proofs(db, ctx.tenant_id, opportunity_id)
    return _workspace(opp, reqs, latest)


@router.post(f"{_BASE}/requirements/{{requirement_id}}/review", response_model=ProofResponse)
async def review_proof(
    product_id: uuid.UUID,
    opportunity_id: uuid.UUID,
    requirement_id: uuid.UUID,
    req: ProofReviewRequest,
    user: User = Depends(require_permission("approve")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await _load_opportunity(db, ctx, product_id, opportunity_id)
    reqs, latest = await _requirements_with_proofs(db, ctx.tenant_id, opportunity_id)
    if not any(r.id == requirement_id for r in reqs):
        raise HTTPException(status_code=404, detail="Requirement not found")
    proof = latest.get(requirement_id)
    if proof is None:
        raise HTTPException(status_code=409, detail="Analyze the requirement before reviewing it")
    if req.status == "approved" and proof.stale_reason:
        raise HTTPException(
            status_code=409, detail="Evidence changed since this proof was written; re-analyze it first"
        )
    proof.review_status = req.status
    proof.reviewer_id = user.id
    proof.review_comment = req.comment
    if req.conditions is not None:
        proof.conditions = req.conditions or None
    await audit_log(db, ctx.tenant_id, user.id, f"proof_{req.status}", "requirement", str(requirement_id))
    await db.commit()
    return _proof_out(proof)


@router.post(f"{_BASE}/requirements/response", response_model=RequirementResponseDocument)
async def create_response_document(
    product_id: uuid.UUID,
    opportunity_id: uuid.UUID,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    """Draft a customer-ready response from approved, non-stale proofs. The result is a
    DRAFT proposal artifact and still goes through the normal artifact approval."""
    ctx = await get_tenant_context(user, db)
    opp = await _load_opportunity(db, ctx, product_id, opportunity_id)
    reqs, latest = await _requirements_with_proofs(db, ctx.tenant_id, opportunity_id)

    items, citations = [], {}
    skipped_unapproved = skipped_stale = 0
    for r in reqs:
        p = latest.get(r.id)
        if p is None or p.review_status != "approved":
            skipped_unapproved += 1
        elif p.stale_reason:
            skipped_stale += 1
        else:
            items.append({
                "requirement": r.text, "verdict": p.verdict, "answer": p.answer,
                "conditions": p.conditions, "validation_test": p.validation_test,
            })
            for c in p.citations or []:
                citations[c["chunk_id"]] = c
    if not items:
        raise HTTPException(status_code=409, detail="No approved, up-to-date proofs to include")

    content = build_response_document(items)
    artifact = Artifact(
        product_id=product_id, tenant_id=ctx.tenant_id, artifact_type=ArtifactType.PROPOSAL,
        title=f"Technical response - {opp.name}", content=content,
        content_hash=content_hash(content), status=ApprovalStatus.DRAFT,
        citations=list(citations.values()),
        metadata_={"opportunity_id": str(opportunity_id), "kind": "requirement_response"},
        created_by=user.id,
    )
    db.add(artifact)
    await db.flush()
    await record_dependencies(db, artifact)
    await audit_log(db, ctx.tenant_id, user.id, "requirement_response_drafted", "artifact", str(artifact.id))
    await db.commit()
    return RequirementResponseDocument(
        artifact_id=artifact.id, included=len(items),
        skipped_unapproved=skipped_unapproved, skipped_stale=skipped_stale,
    )


@router.get("/action-list", response_model=ActionListResponse)
async def action_list(
    product_id: uuid.UUID | None = None,
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """What needs attention today across deals and drafts (tenant-wide, or one product)."""
    ctx = await get_tenant_context(user, db)
    if product_id:
        await get_product_for_tenant(db, product_id, ctx.tenant_id)
    items = await build_action_list(db, ctx.tenant_id, datetime.now(UTC), product_id)
    return ActionListResponse(
        items=[ActionItemResponse(**vars(i)) for i in items[:limit]],
        counts=dict(Counter(i.kind for i in items)),  # over the full list, not just this page
        follow_up_after_days=FOLLOW_UP_AFTER_DAYS,
    )
