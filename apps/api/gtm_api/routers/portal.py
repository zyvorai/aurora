"""External customer portal (Phase 1 of the customer/salesperson/reseller portal work).

Public signup + login for the tenant's own end-customers, plus an internal-admin
approval queue. Deliberately separate from routers/auth.py's employee login: portal
identities live in their own table (CustomerAccount) and issue their own token type
(see auth.py::create_portal_token / get_current_portal_account) so an external,
non-employee login can never satisfy an internal `Depends(get_current_user)`.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
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
    DealRegistrationRequest,
    DealRegistrationResponse,
    OpportunityResponse,
    PortalLoginRequest,
    PortalRejectRequest,
    PortalSignupRequest,
    PortalSignupResponse,
    PortalTokenResponse,
    ResellerAccountResponse,
    ResellerSignupRequest,
    SalesPersonAccountResponse,
    SalesPersonPipelineResponse,
    SalesPersonSignupRequest,
)
from gtm_api.tenant import audit_log, get_tenant_context

router = APIRouter(prefix="/portal", tags=["portal"])


async def _get_active_tenant_by_slug(db: AsyncSession, tenant_slug: str) -> Tenant:
    result = await db.execute(
        select(Tenant).where(Tenant.slug == tenant_slug, Tenant.is_active.is_(True))
    )
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return tenant


@router.post("/customer/signup", response_model=PortalSignupResponse, status_code=201)
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
    return account


@router.post("/customer/accounts/{account_id}/reject", response_model=CustomerAccountResponse)
async def reject_customer_account(
    account_id: uuid.UUID,
    req: PortalRejectRequest,
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
    return account


# ---- Reseller portal: same lifecycle as customer, plus deal registration ----


@router.post("/reseller/signup", response_model=PortalSignupResponse, status_code=201)
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


@router.post("/reseller/accounts/{account_id}/approve", response_model=ResellerAccountResponse)
async def approve_reseller_account(
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
    return account


@router.post("/reseller/accounts/{account_id}/reject", response_model=ResellerAccountResponse)
async def reject_reseller_account(
    account_id: uuid.UUID,
    req: PortalRejectRequest,
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
    return account


# ---- Sales-person portal: same lifecycle as customer/reseller, scoped to their own
# assigned Lead/Opportunity rows via assigned_sales_person_id ----


@router.post("/salesperson/signup", response_model=PortalSignupResponse, status_code=201)
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


@router.post("/salesperson/accounts/{account_id}/approve", response_model=SalesPersonAccountResponse)
async def approve_salesperson_account(
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
    return account


@router.post("/salesperson/accounts/{account_id}/reject", response_model=SalesPersonAccountResponse)
async def reject_salesperson_account(
    account_id: uuid.UUID,
    req: PortalRejectRequest,
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
    return account
