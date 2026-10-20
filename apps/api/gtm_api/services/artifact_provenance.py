"""Source-version provenance for artifacts and stale detection.

Chain: source document version -> citation -> artifact. When knowledge refresh ingests a
changed document, artifacts that relied on the old version are flagged for re-review.
"""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import (
    ApprovalStatus,
    Artifact,
    ArtifactDependency,
    ArtifactType,
    Chunk,
    Document,
    Requirement,
    RequirementProof,
)

STALE_SOURCE_CHANGED = "source_changed"
# Artifact has no recorded citations, so we cannot tell whether it used the changed source.
STALE_UNVERIFIED = "source_changed_unverified"

# Artifact types that make factual product claims to a customer.
_CLAIM_BEARING = (
    ArtifactType.PROPOSAL,
    ArtifactType.CONTENT,
    ArtifactType.EMAIL,
    ArtifactType.PRESENTATION,
    ArtifactType.OUTREACH,
)


async def documents_for_citations(
    db: AsyncSession, tenant_id: uuid.UUID, citations: list[dict]
) -> list[Document]:
    """Documents behind citations (``chunk_id`` = ``Chunk.qdrant_point_id``)."""
    chunk_ids = {c.get("chunk_id") for c in citations if c.get("chunk_id")}
    if not chunk_ids:
        return []
    rows = await db.execute(
        select(Document)
        .join(Chunk, Chunk.document_id == Document.id)
        .where(Chunk.qdrant_point_id.in_(chunk_ids), Document.tenant_id == tenant_id)
        .distinct()
    )
    return list(rows.scalars().all())


async def record_dependencies(db: AsyncSession, artifact: Artifact) -> int:
    """Store the document version behind each of ``artifact.citations``. Returns rows added.

    Citations carry ``chunk_id`` = ``Chunk.qdrant_point_id``. The artifact must have been
    flushed (it needs an id).
    """
    docs = await documents_for_citations(db, artifact.tenant_id, artifact.citations or [])
    added = 0
    for doc in docs:
        db.add(
            ArtifactDependency(
                tenant_id=artifact.tenant_id,
                artifact_id=artifact.id,
                document_id=doc.id,
                document_url=doc.url,
                document_title=doc.title or "",
                content_hash_at_use=doc.content_hash,
            )
        )
        added += 1
    return added


async def _current_document(
    db: AsyncSession, dep: ArtifactDependency, product_id: uuid.UUID
) -> Document | None:
    """Latest version of the document a dependency points at (by URL, else by id)."""
    if dep.document_url:
        query = (
            select(Document)
            .where(Document.product_id == product_id, Document.url == dep.document_url)
            .order_by(Document.created_at.desc())
            .limit(1)
        )
    else:
        query = select(Document).where(Document.id == dep.document_id)
    return (await db.execute(query)).scalars().first()


async def mark_stale_artifacts(
    db: AsyncSession,
    product_id: uuid.UUID,
    tenant_id: uuid.UUID,
    changed_since: datetime,
    now: datetime,
) -> dict:
    """Flag artifacts affected by a knowledge refresh. ``changed_since`` is when the
    refresh started; artifacts created before it that lack provenance are flagged as
    unverified. Already-stale artifacts are left alone."""
    result = await db.execute(
        select(Artifact).where(
            Artifact.product_id == product_id,
            Artifact.tenant_id == tenant_id,
            Artifact.stale_reason.is_(None),
        )
    )
    exact = unverified = 0
    for artifact in result.scalars().all():
        deps = (
            await db.execute(
                select(ArtifactDependency).where(ArtifactDependency.artifact_id == artifact.id)
            )
        ).scalars().all()

        if deps:
            for dep in deps:
                current = await _current_document(db, dep, product_id)
                if current is None or current.content_hash != dep.content_hash_at_use:
                    artifact.stale_reason = STALE_SOURCE_CHANGED
                    artifact.stale_since = now
                    exact += 1
                    break
        elif (
            artifact.artifact_type in _CLAIM_BEARING
            and artifact.status in (ApprovalStatus.PENDING, ApprovalStatus.APPROVED)
            and artifact.created_at is not None
            and artifact.created_at < changed_since
        ):
            artifact.stale_reason = STALE_UNVERIFIED
            artifact.stale_since = now
            unverified += 1
    return {"stale": exact, "unverified": unverified}


async def acknowledge_current_sources(db: AsyncSession, artifact: Artifact) -> None:
    """Called on re-approval: clear the stale flag and re-pin dependencies to the
    current document versions (dropping ones whose document no longer exists)."""
    deps = (
        await db.execute(
            select(ArtifactDependency).where(ArtifactDependency.artifact_id == artifact.id)
        )
    ).scalars().all()
    for dep in deps:
        current = await _current_document(db, dep, artifact.product_id)
        if current is None:
            await db.delete(dep)
        else:
            dep.document_id = current.id
            dep.content_hash_at_use = current.content_hash
    artifact.stale_reason = None
    artifact.stale_since = None


async def mark_stale_proofs(db: AsyncSession, product_id: uuid.UUID, tenant_id: uuid.UUID) -> int:
    """Flag requirement proofs whose cited document changed or disappeared."""
    rows = await db.execute(
        select(RequirementProof)
        .join(Requirement, Requirement.id == RequirementProof.requirement_id)
        .where(
            Requirement.product_id == product_id,
            RequirementProof.tenant_id == tenant_id,
            RequirementProof.stale_reason.is_(None),
        )
    )
    flagged = 0
    for proof in rows.scalars().all():
        for ver in proof.source_versions or []:
            dep = ArtifactDependency(
                document_id=uuid.UUID(ver["document_id"]),
                document_url=ver.get("url"),
                content_hash_at_use=ver["content_hash"],
            )
            current = await _current_document(db, dep, product_id)
            if current is None or current.content_hash != ver["content_hash"]:
                proof.stale_reason = STALE_SOURCE_CHANGED
                flagged += 1
                break
    return flagged
