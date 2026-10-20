"""SEO routes: page audit, keyword research, artifact scoring. All results are computed or measured, never invented."""

import json
import uuid
from urllib.parse import urljoin

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import get_current_user, require_permission
from gtm_api.config import get_settings
from gtm_api.database import get_db
from gtm_api.models import ApprovalStatus, Artifact, User
from gtm_api.services.crawler import CrawlError, validate_url
from gtm_api.services.seo import audit_html, get_provider
from gtm_api.services.seo.artifact import seo_metadata
from gtm_api.tenant import audit_log, get_product_for_tenant, get_tenant_context

router = APIRouter(tags=["seo"])

_MAX_BYTES = 2_000_000
_MAX_REDIRECTS = 3


class AuditRequest(BaseModel):
    url: str = Field(..., max_length=2048)


class KeywordRequest(BaseModel):
    seed: str = Field("", max_length=200)
    limit: int = Field(25, ge=1, le=100)
    provider: str | None = Field(None, description="grounded | dataforseo | search_console (default: SEO_PROVIDER)")


class ScoreRequest(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=200)


async def fetch_page(url: str) -> str:
    """Fetch one page with SSRF validation on every hop, no cookies, a size cap and a hard redirect limit."""
    s = get_settings()
    current = validate_url(url)
    async with httpx.AsyncClient(timeout=s.crawl_timeout_seconds, follow_redirects=False, headers={"User-Agent": s.crawl_user_agent}) as client:
        for _ in range(_MAX_REDIRECTS + 1):
            r = await client.get(current)
            if r.status_code in (301, 302, 303, 307, 308) and r.headers.get("location"):
                current = validate_url(urljoin(current, r.headers["location"]))
                continue
            if r.status_code != 200:
                raise CrawlError(f"Page returned HTTP {r.status_code}")
            if len(r.content) > _MAX_BYTES:
                raise CrawlError("Page is larger than 2 MB")
            return r.text
    raise CrawlError("Too many redirects")


@router.get("/seo/providers")
async def providers(user: User = Depends(get_current_user)):
    s = get_settings()
    return {
        "default": s.seo_provider,
        "providers": {
            "grounded": {"configured": True, "measured": False, "note": "Terms mined from your knowledge base; estimates only."},
            "dataforseo": {"configured": s.dataforseo_configured, "measured": True, "note": "Search volume and difficulty."},
            "search_console": {"configured": s.gsc_configured, "measured": True, "note": "Your own queries, clicks and position."},
        },
        "publish": {"wordpress": s.wordpress_configured},
    }


@router.post("/products/{product_id}/seo/audit")
async def audit_page(
    product_id: uuid.UUID,
    req: AuditRequest,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    try:
        html = await fetch_page(req.url)
    except CrawlError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch the page: {exc}")
    result = audit_html(html, req.url).to_dict()
    await audit_log(db, ctx.tenant_id, user.id, "seo_audit", "product", str(product_id), details={"url": req.url, "score": result["score"]})
    await db.commit()
    return result


@router.post("/products/{product_id}/seo/keywords")
async def keyword_research(
    product_id: uuid.UUID,
    req: KeywordRequest,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    product = await get_product_for_tenant(db, product_id, ctx.tenant_id)
    corpus = [json.dumps(product.profile)] if product.profile else []
    seed = req.seed.strip() or (product.name or "")
    try:
        from gtm_api.services.embeddings import embedding_service
        from gtm_api.services.vector_store import vector_store

        vec = await embedding_service.embed_query(seed)
        hits = await vector_store.search(ctx.tenant_id, product.id, vec, limit=12)
        corpus.extend(h.content for h in hits)
    except Exception:
        pass
    provider = get_provider(req.provider)
    try:
        keywords = await provider.suggest(seed, corpus, req.limit)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"{provider.name} request failed: {exc}")
    return {"provider": provider.name, "measured": provider.name != "estimate", "keywords": [k.to_dict() for k in keywords]}


@router.post("/artifacts/{artifact_id}/seo/score")
async def score_artifact(
    artifact_id: uuid.UUID,
    req: ScoreRequest,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    """Recompute the SEO block (meta + score + JSON-LD) for an artifact. The block is published with the content, so
    changing it on an approved artifact sends the artifact back to draft: the reviewer must approve the new meta too."""
    ctx = await get_tenant_context(user, db)
    row = await db.execute(select(Artifact).where(Artifact.id == artifact_id, Artifact.tenant_id == ctx.tenant_id))
    artifact = row.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    seo = seo_metadata(artifact.title or "", artifact.content or "", req.keyword.strip())
    previous = (artifact.metadata_ or {}).get("seo")
    artifact.metadata_ = {**(artifact.metadata_ or {}), "seo": seo}
    if artifact.status == ApprovalStatus.APPROVED and previous != seo:
        artifact.status = ApprovalStatus.DRAFT
    await audit_log(db, ctx.tenant_id, user.id, "seo_score", "artifact", str(artifact_id), details={"score": seo["score"]})
    await db.commit()
    return seo
