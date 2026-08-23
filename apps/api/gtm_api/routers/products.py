"""Product and ingestion routes."""

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import get_current_user, require_permission
from gtm_api.config import get_settings
from gtm_api.database import get_db
from gtm_api.models import Product, Source, SourceStatus, SourceType, User
from gtm_api.schemas import (
    Citation,
    DatabaseSourceCreate,
    DatabaseTestRequest,
    DatabaseTestResponse,
    IngestRequest,
    IngestResponse,
    ProductCreate,
    ProductProfile,
    ProductResponse,
    QueryRequest,
    QueryResponse,
    SourceCreate,
    SourceResponse,
)
from gtm_api.agents.product_understanding import run_product_understanding
from gtm_api.services.analytics import emit_event
from gtm_api.services.citation_gate import (
    SYSTEM_PROMPT_GROUNDED,
    verify_grounding,
)
from gtm_api.services.mcp import gather_decision_context
from gtm_api.services.enterprise import check_product_limit
from gtm_api.services.ingestion import ingest_all_sources, ingest_source
from gtm_api.services.job_queue import enqueue_source_ingest
from gtm_api.services.source_service import (
    create_credential,
    delete_source,
    store_upload,
    test_database_connection,
    validate_source_type,
)
from gtm_api.tenant import audit_log, get_product_for_tenant, get_tenant_context
from gtm_api.services.llm import get_chat_model

settings = get_settings()
router = APIRouter(prefix="/products", tags=["products"])


def _source_response(source: Source) -> SourceResponse:
    return SourceResponse.from_source(source)


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
            display_name=f"{req.name} website",
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


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_product(
    product_id: uuid.UUID,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete -- flips `is_active` off rather than removing the row, since 18
    other tables FK into products with no cascade configured and a hard delete
    would just fail. `list_products` already filters on `is_active`, so this is
    the only change needed to make a product disappear from the app."""
    ctx = await get_tenant_context(user, db)
    product = await get_product_for_tenant(db, product_id, ctx.tenant_id)
    product.is_active = False
    await audit_log(db, ctx.tenant_id, user.id, "delete", "product", str(product_id))


@router.post("/{product_id}/sources", response_model=SourceResponse)
async def add_source(
    product_id: uuid.UUID,
    req: SourceCreate,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    try:
        st = validate_source_type(req.source_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if st not in (SourceType.FILE, SourceType.SPREADSHEET, SourceType.AUDIO, SourceType.DATABASE):
        if not req.url:
            raise HTTPException(status_code=400, detail="url is required for this source type")

    credential_id = None
    if req.github_token and st == SourceType.GITHUB:
        cred = await create_credential(
            db, ctx.tenant_id, "github", {"token": req.github_token}
        )
        credential_id = cred.id

    source = Source(
        product_id=product_id,
        tenant_id=ctx.tenant_id,
        source_type=st,
        url=req.url,
        display_name=req.display_name,
        metadata_=req.metadata or {},
        credential_id=credential_id,
    )
    db.add(source)
    await db.flush()
    await audit_log(db, ctx.tenant_id, user.id, "create", "source", str(source.id))
    return _source_response(source)


@router.post("/{product_id}/sources/upload", response_model=SourceResponse)
async def upload_source(
    product_id: uuid.UUID,
    file: UploadFile = File(...),
    source_type: str = Form(...),
    display_name: str | None = Form(None),
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    try:
        st = validate_source_type(source_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if st not in (
        SourceType.FILE,
        SourceType.SPREADSHEET,
        SourceType.AUDIO,
        SourceType.VIDEO,
        SourceType.PDF,
        SourceType.OPENAPI,
        SourceType.DATABASE,
    ):
        raise HTTPException(status_code=400, detail=f"Upload not supported for type {source_type}")

    data = await file.read()
    max_bytes = (
        settings.upload_max_media_bytes
        if st in (SourceType.AUDIO, SourceType.VIDEO)
        else settings.upload_max_bytes
    )
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds max size ({max_bytes} bytes)")

    filename = file.filename or "upload"
    source = Source(
        product_id=product_id,
        tenant_id=ctx.tenant_id,
        source_type=st,
        display_name=display_name or filename,
        metadata_={"mode": "upload"} if st == SourceType.DATABASE else {},
    )
    db.add(source)
    await db.flush()

    await store_upload(
        db,
        source,
        filename,
        data,
        file.content_type or "application/octet-stream",
    )
    await audit_log(db, ctx.tenant_id, user.id, "upload", "source", str(source.id))
    return _source_response(source)


@router.post("/{product_id}/sources/database", response_model=SourceResponse)
async def add_database_source(
    product_id: uuid.UUID,
    req: DatabaseSourceCreate,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    if not req.read_only:
        raise HTTPException(status_code=400, detail="Only read-only database sources are supported")

    cred = await create_credential(
        db,
        ctx.tenant_id,
        "database",
        {
            "engine": req.engine,
            "host": req.host,
            "port": req.port,
            "database": req.database,
            "username": req.username,
            "password": req.password,
        },
    )

    source = Source(
        product_id=product_id,
        tenant_id=ctx.tenant_id,
        source_type=SourceType.DATABASE,
        display_name=req.display_name or f"DB {req.database}",
        credential_id=cred.id,
        metadata_={"mode": "live", "tables": req.tables},
    )
    db.add(source)
    await db.flush()
    await audit_log(db, ctx.tenant_id, user.id, "create", "source", str(source.id))
    return _source_response(source)


@router.post("/{product_id}/sources/database/test", response_model=DatabaseTestResponse)
async def test_database(
    product_id: uuid.UUID,
    req: DatabaseTestRequest,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    try:
        tables = await test_database_connection(
            {
                "engine": req.engine,
                "host": req.host,
                "port": req.port,
                "database": req.database,
                "username": req.username,
                "password": req.password,
            }
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return DatabaseTestResponse(tables=tables)


@router.get("/{product_id}/sources", response_model=list[SourceResponse])
async def list_sources(
    product_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    result = await db.execute(
        select(Source).where(Source.product_id == product_id, Source.tenant_id == ctx.tenant_id)
    )
    return [_source_response(s) for s in result.scalars().all()]


@router.get("/{product_id}/sources/{source_id}", response_model=SourceResponse)
async def get_source(
    product_id: uuid.UUID,
    source_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    source = await db.get(Source, source_id)
    if not source or source.product_id != product_id or source.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Source not found")
    return _source_response(source)


@router.delete("/{product_id}/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_source(
    product_id: uuid.UUID,
    source_id: uuid.UUID,
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)
    source = await db.get(Source, source_id)
    if not source or source.product_id != product_id or source.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Source not found")

    await delete_source(db, source, ctx.tenant_id)
    await audit_log(db, ctx.tenant_id, user.id, "delete", "source", str(source_id))


@router.post("/{product_id}/ingest", response_model=IngestResponse)
async def trigger_ingest(
    product_id: uuid.UUID,
    req: IngestRequest = IngestRequest(),
    user: User = Depends(require_permission("write")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    await get_product_for_tenant(db, product_id, ctx.tenant_id)

    query = select(Source).where(
        Source.product_id == product_id,
        Source.tenant_id == ctx.tenant_id,
    )
    if req.source_ids:
        query = query.where(Source.id.in_(req.source_ids))

    result = await db.execute(query)
    sources = result.scalars().all()

    if not sources:
        return IngestResponse(
            status="completed",
            message="No sources to ingest",
            sources_queued=0,
        )

    job_ids: list[str] = []

    if req.async_mode and settings.redis_workers_enabled:
        queued_sources = []
        for source in sources:
            if req.force or source.status != SourceStatus.COMPLETED:
                source.status = SourceStatus.PENDING
                job_id = await enqueue_source_ingest(source.id, ctx.tenant_id, product_id)
                if job_id:
                    job_ids.append(job_id)
                    queued_sources.append(source)
        await db.flush()

        if job_ids:
            await audit_log(db, ctx.tenant_id, user.id, "ingest", "product", str(product_id))
            return IngestResponse(
                job_ids=job_ids,
                status="queued",
                message=f"Queued {len(job_ids)} source(s) for ingest",
                sources_queued=len(job_ids),
            )

        # Workers unavailable — fall through to synchronous ingest
    ingest_result = await ingest_all_sources(
        db,
        product_id,
        ctx.tenant_id,
        req.source_ids,
        force=req.force,
    )
    await audit_log(db, ctx.tenant_id, user.id, "ingest", "product", str(product_id))

    return IngestResponse(
        job_ids=[],
        status="completed",
        message=f"Processed {ingest_result['sources_processed']} sources",
        sources_queued=ingest_result["sources_processed"],
        results=ingest_result.get("results"),
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

    decision_ctx = await gather_decision_context(
        req.question,
        ctx.tenant_id,
        product_id,
        db=db,
        product=product,
        profile=product.profile,
    )
    context = decision_ctx.to_prompt_section()
    results = decision_ctx.search_results

    llm = get_chat_model("sales_agent", temperature=0.1)
    response = await llm.ainvoke([
        {"role": "system", "content": SYSTEM_PROMPT_GROUNDED},
        {
            "role": "user",
            "content": (
                f"Question: {req.question}\n\n"
                f"Multi-source context (use labeled sections; prefer rag for factual claims):\n{context}"
            ),
        },
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
        sources_used=decision_ctx.sources_used,
    )
