"""External customer portal (Phase 1 of the customer/salesperson/reseller portal work).

Public signup + login for the tenant's own end-customers, plus an internal-admin
approval queue. Deliberately separate from routers/auth.py's employee login: portal
identities live in their own table (CustomerAccount) and issue their own token type
(see auth.py::create_portal_token / get_current_portal_account) so an external,
non-employee login can never satisfy an internal `Depends(get_current_user)`.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import (
    create_portal_token,
    get_current_portal_account,
    hash_password,
    require_permission,
    verify_password,
    PortalIdentity,
)
from gtm_api.database import get_db
from gtm_api.services.publishing_adapters.email_adapter import send_transactional_email
from gtm_api.services.rate_limit import enforce_portal_signup_rate_limit
from gtm_api.services.storage import storage_service
from gtm_api.models import (
    CustomerAccount,
    DiscoveredAccount,
    Lead,
    Opportunity,
    PortalAccountStatus,
    Product,
    ResellerAccount,
    SalesPersonAccount,
    Tenant,
    User,
)
from gtm_api.schemas import (
    CustomerAccountResponse,
    CustomerProfileUpdateRequest,
    DealRegistrationRequest,
    DealRegistrationResponse,
    DocumentDownloadUrlResponse,
    DocumentUploadResponse,
    OpportunityResponse,
    PortalLoginRequest,
    PortalRejectRequest,
    PortalSignupRequest,
    PortalSignupResponse,
    PortalTokenResponse,
    ResellerAccountResponse,
    ResellerProfileUpdateRequest,
    ResellerSignupRequest,
    SalesPersonAccountResponse,
    SalesPersonPipelineResponse,
    SalesPersonProfileUpdateRequest,
    SalesPersonSignupRequest,
)
from gtm_api.tenant import audit_log, get_tenant_context

router = APIRouter(prefix="/portal", tags=["portal"])

# Proof-of-business documents (tax ID, business license, etc) are small scanned/photo
# documents, not the bulk source-file uploads products.py handles -- 10MB is generous
# for that and deliberately tighter than settings.upload_max_bytes (100MB).
PORTAL_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024


async def _get_active_tenant_by_slug(db: AsyncSession, tenant_slug: str) -> Tenant:
    result = await db.execute(
        select(Tenant).where(Tenant.slug == tenant_slug, Tenant.is_active.is_(True))
    )
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return tenant


def _notify_portal_decision(
    background_tasks: BackgroundTasks, email: str, portal_label: str, approved: bool, reason: str | None = None
) -> None:
    """Fire-and-forget email so the applicant learns the outcome without polling by
    trying to log in. Scheduled as a background task so it never adds latency to (or
    fails) the approve/reject request itself -- send_transactional_email already
    degrades to a no-op ProviderResult when SMTP isn't configured."""
    if approved:
        subject = f"Your {portal_label} account has been approved"
        body = f"Good news -- your {portal_label} account has been approved. You can now sign in."
    else:
        subject = f"Your {portal_label} account application was not approved"
        body = f"Your {portal_label} account application was not approved."
        if reason:
            body += f"\n\nReason: {reason}"
    background_tasks.add_task(send_transactional_email, email, subject, body)


@router.post(
    "/customer/signup",
    response_model=PortalSignupResponse,
    status_code=201,
    dependencies=[Depends(enforce_portal_signup_rate_limit)],
)
async def customer_signup(req: PortalSignupRequest, db: AsyncSession = Depends(get_db)):
    tenant = await _get_active_tenant_by_slug(db, req.tenant_slug)

    product_result = await db.execute(
        select(Product).where(Product.id == req.product_id, Product.tenant_id == tenant.id)
    )
    if product_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    existing = await db.execute(
        select(CustomerAccount).where(
            CustomerAccount.tenant_id == tenant.id, CustomerAccount.email == req.email
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    account = CustomerAccount(
        tenant_id=tenant.id,
        product_id=req.product_id,
        email=req.email,
        hashed_password=hash_password(req.password),
        company_name=req.company_name,
        contact_name=req.contact_name,
        status=PortalAccountStatus.PENDING,
    )
    db.add(account)
    await audit_log(
        db, tenant.id, None, "portal_signup", "customer_account",
        details={"email": req.email, "company_name": req.company_name},
    )
    await db.flush()
    await db.refresh(account)

    return PortalSignupResponse(id=account.id, status=account.status.value)


@router.post("/customer/login", response_model=PortalTokenResponse)
async def customer_login(req: PortalLoginRequest, db: AsyncSession = Depends(get_db)):
    tenant = await _get_active_tenant_by_slug(db, req.tenant_slug)

    result = await db.execute(
        select(CustomerAccount).where(
            CustomerAccount.tenant_id == tenant.id, CustomerAccount.email == req.email
        )
    )
    account = result.scalar_one_or_none()
    if not account or not verify_password(req.password, account.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if account.status != PortalAccountStatus.APPROVED or not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {account.status.value}, not yet approved for login",
        )

    token = create_portal_token(account.id, tenant.id, portal_type="customer")
    return PortalTokenResponse(access_token=token, account_id=account.id, tenant_id=tenant.id)


@router.get("/customer/me", response_model=CustomerAccountResponse)
async def customer_me(identity: PortalIdentity = Depends(get_current_portal_account)):
    if identity.portal_type != "customer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a customer account")
    return identity.account


@router.patch("/customer/me", response_model=CustomerAccountResponse)
async def update_customer_me(
    req: CustomerProfileUpdateRequest,
    identity: PortalIdentity = Depends(get_current_portal_account),
    db: AsyncSession = Depends(get_db),
):
    if identity.portal_type != "customer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a customer account")
    account = identity.account
    updates = req.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(account, field, value)
    await audit_log(
        db, identity.tenant_id, None, "update_own_profile", "customer_account",
        resource_id=str(identity.account_id), details=updates,
    )
    await db.flush()
    await db.refresh(account)
    return account


@router.get("/customer/accounts", response_model=list[CustomerAccountResponse])
async def list_customer_accounts(
    status_filter: str | None = None,
    user: User = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    query = select(CustomerAccount).where(CustomerAccount.tenant_id == ctx.tenant_id)
    if status_filter:
        query = query.where(CustomerAccount.status == status_filter)
    result = await db.execute(query.order_by(CustomerAccount.created_at.desc()))
    return list(result.scalars().all())


@router.post("/customer/accounts/{account_id}/approve", response_model=CustomerAccountResponse)
async def approve_customer_account(
    account_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(CustomerAccount).where(
            CustomerAccount.id == account_id, CustomerAccount.tenant_id == ctx.tenant_id
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    account.status = PortalAccountStatus.APPROVED
    account.reviewed_by = user.id
    account.reviewed_at = datetime.now(timezone.utc)
    await audit_log(
        db, ctx.tenant_id, user.id, "approve_customer_account", "customer_account",
        resource_id=str(account_id),
    )
    await db.flush()
    await db.refresh(account)
    _notify_portal_decision(background_tasks, account.email, "customer", approved=True)
    return account


@router.post("/customer/accounts/{account_id}/reject", response_model=CustomerAccountResponse)
async def reject_customer_account(
    account_id: uuid.UUID,
    req: PortalRejectRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(CustomerAccount).where(
            CustomerAccount.id == account_id, CustomerAccount.tenant_id == ctx.tenant_id
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    account.status = PortalAccountStatus.REJECTED
    account.rejected_reason = req.reason
    account.reviewed_by = user.id
    account.reviewed_at = datetime.now(timezone.utc)
    await audit_log(
        db, ctx.tenant_id, user.id, "reject_customer_account", "customer_account",
        resource_id=str(account_id), details={"reason": req.reason},
    )
    await db.flush()
    await db.refresh(account)
    _notify_portal_decision(background_tasks, account.email, "customer", approved=False, reason=req.reason)
    return account


# ---- Reseller portal: same lifecycle as customer, plus deal registration ----


@router.post(
    "/reseller/signup",
    response_model=PortalSignupResponse,
    status_code=201,
    dependencies=[Depends(enforce_portal_signup_rate_limit)],
)
async def reseller_signup(req: ResellerSignupRequest, db: AsyncSession = Depends(get_db)):
    tenant = await _get_active_tenant_by_slug(db, req.tenant_slug)

    existing = await db.execute(
        select(ResellerAccount).where(
            ResellerAccount.tenant_id == tenant.id, ResellerAccount.email == req.email
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    account = ResellerAccount(
        tenant_id=tenant.id,
        email=req.email,
        hashed_password=hash_password(req.password),
        company_name=req.company_name,
        contact_name=req.contact_name,
        business_id=req.business_id,
        status=PortalAccountStatus.PENDING,
    )
    db.add(account)
    await audit_log(
        db, tenant.id, None, "portal_signup", "reseller_account",
        details={"email": req.email, "company_name": req.company_name},
    )
    await db.flush()
    await db.refresh(account)

    return PortalSignupResponse(id=account.id, status=account.status.value)


async def _upload_proof_document(
    db: AsyncSession, model: type, portal_type: str, account_id: uuid.UUID, file: UploadFile
) -> str:
    """Shared by the reseller/salesperson signup-document endpoints below. A follow-up
    request (not bundled into signup) so the signup body stays plain JSON like the
    customer/salesperson signups, keeping the existing frontend signup forms unchanged.

    Authorization here is deliberately lightweight: account_id is a random UUID
    returned only to the applicant in the signup response (122 bits of entropy, not
    enumerable), and upload is only accepted while the account is still PENDING -- once
    an admin has reviewed it, the window closes."""
    result = await db.execute(select(model).where(model.id == account_id))
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    if account.status != PortalAccountStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Documents can only be uploaded while the application is pending review",
        )

    data = await file.read()
    if len(data) > PORTAL_DOCUMENT_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File exceeds max size ({PORTAL_DOCUMENT_MAX_BYTES} bytes)",
        )

    filename = (file.filename or "document").replace("/", "_").replace("\\", "_")
    key = f"portal-documents/{account.tenant_id}/{portal_type}/{account_id}/{filename}"
    storage_service.put_bytes(key, data, file.content_type or "application/octet-stream")

    account.proof_document_key = key
    await audit_log(
        db, account.tenant_id, None, "upload_proof_document", f"{portal_type}_account",
        resource_id=str(account_id),
    )
    await db.flush()
    return key


@router.post(
    "/reseller/signup/{account_id}/document",
    response_model=DocumentUploadResponse,
    dependencies=[Depends(enforce_portal_signup_rate_limit)],
)
async def upload_reseller_document(
    account_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    key = await _upload_proof_document(db, ResellerAccount, "reseller", account_id, file)
    return DocumentUploadResponse(proof_document_key=key)


@router.post("/reseller/login", response_model=PortalTokenResponse)
async def reseller_login(req: PortalLoginRequest, db: AsyncSession = Depends(get_db)):
    tenant = await _get_active_tenant_by_slug(db, req.tenant_slug)

    result = await db.execute(
        select(ResellerAccount).where(
            ResellerAccount.tenant_id == tenant.id, ResellerAccount.email == req.email
        )
    )
    account = result.scalar_one_or_none()
    if not account or not verify_password(req.password, account.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if account.status != PortalAccountStatus.APPROVED or not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {account.status.value}, not yet approved for login",
        )

    token = create_portal_token(account.id, tenant.id, portal_type="reseller")
    return PortalTokenResponse(access_token=token, portal_type="reseller", account_id=account.id, tenant_id=tenant.id)


@router.get("/reseller/me", response_model=ResellerAccountResponse)
async def reseller_me(identity: PortalIdentity = Depends(get_current_portal_account)):
    if identity.portal_type != "reseller":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a reseller account")
    return identity.account


@router.patch("/reseller/me", response_model=ResellerAccountResponse)
async def update_reseller_me(
    req: ResellerProfileUpdateRequest,
    identity: PortalIdentity = Depends(get_current_portal_account),
    db: AsyncSession = Depends(get_db),
):
    if identity.portal_type != "reseller":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a reseller account")
    account = identity.account
    updates = req.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(account, field, value)
    await audit_log(
        db, identity.tenant_id, None, "update_own_profile", "reseller_account",
        resource_id=str(identity.account_id), details=updates,
    )
    await db.flush()
    await db.refresh(account)
    return account


@router.post("/reseller/deals", response_model=DealRegistrationResponse, status_code=201)
async def register_deal(
    req: DealRegistrationRequest,
    identity: PortalIdentity = Depends(get_current_portal_account),
    db: AsyncSession = Depends(get_db),
):
    if identity.portal_type != "reseller":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a reseller account")

    product_result = await db.execute(
        select(Product).where(Product.id == req.product_id, Product.tenant_id == identity.tenant_id)
    )
    if product_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    deal = DiscoveredAccount(
        product_id=req.product_id,
        tenant_id=identity.tenant_id,
        company_name=req.company_name,
        domain=req.domain,
        industry=req.industry,
        company_size=req.company_size,
        geo=req.geo,
        source="reseller_referral",
        registered_by_reseller_id=identity.account_id,
    )
    db.add(deal)
    await audit_log(
        db, identity.tenant_id, None, "register_deal", "discovered_account",
        details={"company_name": req.company_name, "reseller_account_id": str(identity.account_id)},
    )
    await db.flush()
    await db.refresh(deal)
    return deal


@router.get("/reseller/deals", response_model=list[DealRegistrationResponse])
async def list_my_deals(identity: PortalIdentity = Depends(get_current_portal_account), db: AsyncSession = Depends(get_db)):
    if identity.portal_type != "reseller":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a reseller account")
    result = await db.execute(
        select(DiscoveredAccount)
        .where(DiscoveredAccount.registered_by_reseller_id == identity.account_id)
        .order_by(DiscoveredAccount.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/reseller/accounts", response_model=list[ResellerAccountResponse])
async def list_reseller_accounts(
    status_filter: str | None = None,
    user: User = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    query = select(ResellerAccount).where(ResellerAccount.tenant_id == ctx.tenant_id)
    if status_filter:
        query = query.where(ResellerAccount.status == status_filter)
    result = await db.execute(query.order_by(ResellerAccount.created_at.desc()))
    return list(result.scalars().all())


@router.get("/reseller/accounts/{account_id}/document", response_model=DocumentDownloadUrlResponse)
async def get_reseller_document_url(
    account_id: uuid.UUID,
    user: User = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(ResellerAccount).where(
            ResellerAccount.id == account_id, ResellerAccount.tenant_id == ctx.tenant_id
        )
    )
    account = result.scalar_one_or_none()
    if account is None or not account.proof_document_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No document on file")
    return DocumentDownloadUrlResponse(url=storage_service.presigned_get(account.proof_document_key))


@router.post("/reseller/accounts/{account_id}/approve", response_model=ResellerAccountResponse)
async def approve_reseller_account(
    account_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(ResellerAccount).where(
            ResellerAccount.id == account_id, ResellerAccount.tenant_id == ctx.tenant_id
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    account.status = PortalAccountStatus.APPROVED
    account.reviewed_by = user.id
    account.reviewed_at = datetime.now(timezone.utc)
    await audit_log(
        db, ctx.tenant_id, user.id, "approve_reseller_account", "reseller_account",
        resource_id=str(account_id),
    )
    await db.flush()
    await db.refresh(account)
    _notify_portal_decision(background_tasks, account.email, "reseller", approved=True)
    return account


@router.post("/reseller/accounts/{account_id}/reject", response_model=ResellerAccountResponse)
async def reject_reseller_account(
    account_id: uuid.UUID,
    req: PortalRejectRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(ResellerAccount).where(
            ResellerAccount.id == account_id, ResellerAccount.tenant_id == ctx.tenant_id
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    account.status = PortalAccountStatus.REJECTED
    account.rejected_reason = req.reason
    account.reviewed_by = user.id
    account.reviewed_at = datetime.now(timezone.utc)
    await audit_log(
        db, ctx.tenant_id, user.id, "reject_reseller_account", "reseller_account",
        resource_id=str(account_id), details={"reason": req.reason},
    )
    await db.flush()
    await db.refresh(account)
    _notify_portal_decision(background_tasks, account.email, "reseller", approved=False, reason=req.reason)
    return account


# ---- Sales-person portal: same lifecycle as customer/reseller, scoped to their own
# assigned Lead/Opportunity rows via assigned_sales_person_id ----


@router.post(
    "/salesperson/signup",
    response_model=PortalSignupResponse,
    status_code=201,
    dependencies=[Depends(enforce_portal_signup_rate_limit)],
)
async def salesperson_signup(req: SalesPersonSignupRequest, db: AsyncSession = Depends(get_db)):
    tenant = await _get_active_tenant_by_slug(db, req.tenant_slug)

    existing = await db.execute(
        select(SalesPersonAccount).where(
            SalesPersonAccount.tenant_id == tenant.id, SalesPersonAccount.email == req.email
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    account = SalesPersonAccount(
        tenant_id=tenant.id,
        email=req.email,
        hashed_password=hash_password(req.password),
        contact_name=req.contact_name,
        territory=req.territory,
        status=PortalAccountStatus.PENDING,
    )
    db.add(account)
    await audit_log(
        db, tenant.id, None, "portal_signup", "sales_person_account",
        details={"email": req.email},
    )
    await db.flush()
    await db.refresh(account)

    return PortalSignupResponse(id=account.id, status=account.status.value)


@router.post(
    "/salesperson/signup/{account_id}/document",
    response_model=DocumentUploadResponse,
    dependencies=[Depends(enforce_portal_signup_rate_limit)],
)
async def upload_salesperson_document(
    account_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    key = await _upload_proof_document(db, SalesPersonAccount, "salesperson", account_id, file)
    return DocumentUploadResponse(proof_document_key=key)


@router.post("/salesperson/login", response_model=PortalTokenResponse)
async def salesperson_login(req: PortalLoginRequest, db: AsyncSession = Depends(get_db)):
    tenant = await _get_active_tenant_by_slug(db, req.tenant_slug)

    result = await db.execute(
        select(SalesPersonAccount).where(
            SalesPersonAccount.tenant_id == tenant.id, SalesPersonAccount.email == req.email
        )
    )
    account = result.scalar_one_or_none()
    if not account or not verify_password(req.password, account.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if account.status != PortalAccountStatus.APPROVED or not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {account.status.value}, not yet approved for login",
        )

    token = create_portal_token(account.id, tenant.id, portal_type="salesperson")
    return PortalTokenResponse(access_token=token, portal_type="salesperson", account_id=account.id, tenant_id=tenant.id)


@router.get("/salesperson/me", response_model=SalesPersonAccountResponse)
async def salesperson_me(identity: PortalIdentity = Depends(get_current_portal_account)):
    if identity.portal_type != "salesperson":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a sales-person account")
    return identity.account


@router.patch("/salesperson/me", response_model=SalesPersonAccountResponse)
async def update_salesperson_me(
    req: SalesPersonProfileUpdateRequest,
    identity: PortalIdentity = Depends(get_current_portal_account),
    db: AsyncSession = Depends(get_db),
):
    if identity.portal_type != "salesperson":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a sales-person account")
    account = identity.account
    updates = req.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(account, field, value)
    await audit_log(
        db, identity.tenant_id, None, "update_own_profile", "sales_person_account",
        resource_id=str(identity.account_id), details=updates,
    )
    await db.flush()
    await db.refresh(account)
    return account


@router.get("/salesperson/my-pipeline", response_model=SalesPersonPipelineResponse)
async def salesperson_my_pipeline(
    identity: PortalIdentity = Depends(get_current_portal_account), db: AsyncSession = Depends(get_db)
):
    if identity.portal_type != "salesperson":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a sales-person account")

    lead_result = await db.execute(
        select(Lead)
        .where(Lead.assigned_sales_person_id == identity.account_id)
        .order_by(Lead.created_at.desc())
    )
    leads = list(lead_result.scalars().all())

    opp_result = await db.execute(
        select(Opportunity)
        .where(Opportunity.assigned_sales_person_id == identity.account_id)
        .order_by(Opportunity.created_at.desc())
    )
    opportunities = [
        OpportunityResponse(
            id=opp.id,
            name=opp.name,
            company=opp.company,
            stage=opp.stage,
            amount=opp.amount,
            probability=opp.probability,
            lead_id=opp.lead_id,
            proposal_artifact_id=opp.proposal_artifact_id,
            architect_artifact_id=opp.architect_artifact_id,
            metadata=opp.metadata_ or {},
            created_at=opp.created_at,
            updated_at=opp.updated_at,
        )
        for opp in opp_result.scalars().all()
    ]

    return SalesPersonPipelineResponse(leads=leads, opportunities=opportunities)


@router.get("/salesperson/accounts", response_model=list[SalesPersonAccountResponse])
async def list_salesperson_accounts(
    status_filter: str | None = None,
    user: User = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    query = select(SalesPersonAccount).where(SalesPersonAccount.tenant_id == ctx.tenant_id)
    if status_filter:
        query = query.where(SalesPersonAccount.status == status_filter)
    result = await db.execute(query.order_by(SalesPersonAccount.created_at.desc()))
    return list(result.scalars().all())


@router.get("/salesperson/accounts/{account_id}/document", response_model=DocumentDownloadUrlResponse)
async def get_salesperson_document_url(
    account_id: uuid.UUID,
    user: User = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(SalesPersonAccount).where(
            SalesPersonAccount.id == account_id, SalesPersonAccount.tenant_id == ctx.tenant_id
        )
    )
    account = result.scalar_one_or_none()
    if account is None or not account.proof_document_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No document on file")
    return DocumentDownloadUrlResponse(url=storage_service.presigned_get(account.proof_document_key))


@router.post("/salesperson/accounts/{account_id}/approve", response_model=SalesPersonAccountResponse)
async def approve_salesperson_account(
    account_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(SalesPersonAccount).where(
            SalesPersonAccount.id == account_id, SalesPersonAccount.tenant_id == ctx.tenant_id
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    account.status = PortalAccountStatus.APPROVED
    account.reviewed_by = user.id
    account.reviewed_at = datetime.now(timezone.utc)
    await audit_log(
        db, ctx.tenant_id, user.id, "approve_salesperson_account", "sales_person_account",
        resource_id=str(account_id),
    )
    await db.flush()
    await db.refresh(account)
    _notify_portal_decision(background_tasks, account.email, "sales rep", approved=True)
    return account


@router.post("/salesperson/accounts/{account_id}/reject", response_model=SalesPersonAccountResponse)
async def reject_salesperson_account(
    account_id: uuid.UUID,
    req: PortalRejectRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(SalesPersonAccount).where(
            SalesPersonAccount.id == account_id, SalesPersonAccount.tenant_id == ctx.tenant_id
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    account.status = PortalAccountStatus.REJECTED
    account.rejected_reason = req.reason
    account.reviewed_by = user.id
    account.reviewed_at = datetime.now(timezone.utc)
    await audit_log(
        db, ctx.tenant_id, user.id, "reject_salesperson_account", "sales_person_account",
        resource_id=str(account_id), details={"reason": req.reason},
    )
    await db.flush()
    await db.refresh(account)
    _notify_portal_decision(background_tasks, account.email, "sales rep", approved=False, reason=req.reason)
    return account
