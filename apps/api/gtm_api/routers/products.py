"""Product and ingestion routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import get_current_user, require_permission
from gtm_api.config import get_settings
from gtm_api.database import get_db
from gtm_api.models import Product, Source, SourceStatus, SourceType, User
from gtm_api.schemas import (
    IngestRequest,
    IngestResponse,
    ProductCreate,
    ProductProfile,
    ProductResponse,
    QueryRequest,
    QueryResponse,
    SourceCreate,
    SourceResponse,
    Citation,
)
from gtm_api.agents.product_understanding import run_product_understanding
from gtm_api.services.analytics import emit_event
from gtm_api.services.citation_gate import (
    SYSTEM_PROMPT_GROUNDED,
    build_context_from_results,
    verify_grounding,
)
from gtm_api.services.embeddings import embedding_service
from gtm_api.services.ingestion import ingest_all_sources
from gtm_api.services.vector_store import vector_store
from gtm_api.services.enterprise import check_product_limit
from gtm_api.tenant import audit_log, get_product_for_tenant, get_tenant_context
from gtm_api.services.llm import get_chat_model

settings = get_settings()
router = APIRouter(prefix="/products", tags=["products"])


@router.post("", response_model=ProductResponse)
async def create_product(
    req: ProductCreate,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    from gtm_api.models import Tenant
    tenant = await db.get(Tenant, ctx.tenant_id)
    if not tenant or not await check_product_limit(db, tenant):
        raise HTTPException(status_code=403, detail="Product limit reached for plan")

    product = Product(
        tenant_id=ctx.tenant_id,
        name=req.name,
        website_url=req.website_url,
        description=req.description,
    )
    db.add(product)
    await db.flush()

    if req.website_url:
        source = Source(
            product_id=product.id,
            tenant_id=ctx.tenant_id,
            source_type=SourceType.WEBSITE,
            url=req.website_url,
        )
        db.add(source)

    await audit_log(db, ctx.tenant_id, user.id, "create", "product", str(product.id))
    return product


@router.get("", response_model=list[ProductResponse])
async def list_products(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(Product).where(Product.tenant_id == ctx.tenant_id, Product.is_active.is_(True))
    )
    return result.scalars().all()


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    return await get_product_for_tenant(db, product_id, ctx.tenant_id)


@router.post("/{product_id}/sources", response_model=SourceResponse)
async def add_source(
    product_id: uuid.UUID,
    req: SourceCreate,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    source = Source(
        product_id=product_id,
        tenant_id=ctx.tenant_id,
        source_type=SourceType(req.source_type),
        url=req.url,
    )
    db.add(source)
    await db.flush()
    return source


@router.get("/{product_id}/sources", response_model=list[SourceResponse])
async def list_sources(
    product_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(Source).where(Source.product_id == product_id, Source.tenant_id == ctx.tenant_id)
    )
    return result.scalars().all()


@router.post("/{product_id}/ingest", response_model=IngestResponse)
async def trigger_ingest(
    product_id: uuid.UUID,
    req: IngestRequest = IngestRequest(),
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    result = await ingest_all_sources(db, product_id, ctx.tenant_id, req.source_ids)
    await audit_log(db, ctx.tenant_id, user.id, "ingest", "product", str(product_id))

    return IngestResponse(
        job_id=str(uuid.uuid4()),
        status="completed",
        message=f"Processed {result['sources_processed']} sources",
    )


@router.post("/{product_id}/understand")
async def trigger_understanding(
    product_id: uuid.UUID,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    product = await get_product_for_tenant(db, product_id, ctx.tenant_id)
    profile = await run_product_understanding(db, product, ctx.tenant_id)
    return {"profile": profile, "status": "ready"}


@router.get("/{product_id}/profile", response_model=ProductProfile)
async def get_profile(
    product_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    product = await get_product_for_tenant(db, product_id, ctx.tenant_id)
    return ProductProfile(**(product.profile or {}))


@router.post("/{product_id}/query", response_model=QueryResponse)
async def query_product(
    product_id: uuid.UUID,
    req: QueryRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    product = await get_product_for_tenant(db, product_id, ctx.tenant_id)

    vector = await embedding_service.embed_query(req.question)
    results = await vector_store.search(ctx.tenant_id, product_id, vector, limit=5)
    context = build_context_from_results(results)

    llm = get_chat_model("sales_agent", temperature=0.1)
    response = await llm.ainvoke([
        {"role": "system", "content": SYSTEM_PROMPT_GROUNDED},
        {"role": "user", "content": f"Question: {req.question}\n\nSources:\n{context}"},
    ])
    answer = response.content

    grounding = verify_grounding(answer, results)
    await emit_event(db, ctx.tenant_id, "query", product_id, {"question": req.question})

    if not grounding.grounded:
        await emit_event(db, ctx.tenant_id, "ungrounded_blocked", product_id, {"query": req.question})

    return QueryResponse(
        answer=answer,
        citations=[Citation(**c.model_dump()) for c in grounding.citations],
        confidence=grounding.confidence,
        grounded=grounding.grounded,
    )
