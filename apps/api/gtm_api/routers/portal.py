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
from gtm_api.models import CustomerAccount, PortalAccountStatus, Product, Tenant, User
from gtm_api.schemas import (
    CustomerAccountResponse,
    PortalLoginRequest,
    PortalRejectRequest,
    PortalSignupRequest,
    PortalSignupResponse,
    PortalTokenResponse,
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
