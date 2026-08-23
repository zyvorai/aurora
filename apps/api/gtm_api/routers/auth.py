"""Authentication routes."""

import secrets
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import (
    ROLE_PERMISSIONS,
    create_access_token,
    create_oauth_exchange_code,
    generate_api_key,
    get_current_user,
    hash_password,
    require_permission,
    slugify,
    verify_password,
)
from gtm_api.config import get_settings
from gtm_api.database import get_db
from gtm_api.models import ApiKey, PlanTier, Tenant, User
from gtm_api.schemas import (
    ApiKeyCreatedResponse,
    ApiKeyResponse,
    CreateApiKeyRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from gtm_api.services.sso import exchange_code_for_tokens, fetch_oidc_discovery, fetch_userinfo
from gtm_api.tenant import audit_log, get_tenant_context

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    slug = slugify(req.tenant_name)
    existing = await db.execute(select(Tenant).where(Tenant.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    tenant = Tenant(name=req.tenant_name, slug=slug, plan=PlanTier.STARTER)
    db.add(tenant)
    await db.flush()

    user = User(
        tenant_id=tenant.id,
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        role="admin",
    )
    db.add(user)
    await db.flush()

    await audit_log(db, tenant.id, user.id, "register", "tenant")

    token = create_access_token(user.id, tenant.id, user.role)
    return TokenResponse(
        access_token=token,
        tenant_id=tenant.id,
        user_id=user.id,
        role=user.role,
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User)
        .where(User.email == req.email, User.is_active.is_(True))
        .order_by(User.created_at.desc())
    )
    user = result.scalars().first()
    if not user or not user.hashed_password or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(user.id, user.tenant_id, user.role)
    return TokenResponse(
        access_token=token,
        tenant_id=user.tenant_id,
        user_id=user.id,
        role=user.role,
    )


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user


@router.post("/api-keys", response_model=ApiKeyCreatedResponse, status_code=201)
async def create_api_key(
    req: CreateApiKeyRequest,
    user: User = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db),
):
    if req.role not in ROLE_PERMISSIONS:
        raise HTTPException(status_code=400, detail=f"Unknown role '{req.role}'")

    ctx = await get_tenant_context(user, db)
    raw_key, key_prefix, key_hash = generate_api_key()
    api_key = ApiKey(
        tenant_id=ctx.tenant_id,
        created_by=user.id,
        name=req.name,
        key_prefix=key_prefix,
        key_hash=key_hash,
        role=req.role,
    )
    db.add(api_key)
    await audit_log(
        db, ctx.tenant_id, user.id, "create_api_key", "api_key",
        details={"name": req.name, "role": req.role},
    )
    await db.flush()
    await db.refresh(api_key)

    return ApiKeyCreatedResponse(
        id=api_key.id, name=api_key.name, role=api_key.role,
        key_prefix=api_key.key_prefix, api_key=raw_key,
    )


@router.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(
    user: User = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(ApiKey).where(ApiKey.tenant_id == ctx.tenant_id).order_by(ApiKey.created_at.desc())
    )
    return list(result.scalars().all())


@router.delete("/api-keys/{key_id}", response_model=ApiKeyResponse)
async def revoke_api_key(
    key_id: uuid.UUID,
    user: User = Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db),
):
    ctx = await get_tenant_context(user, db)
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.tenant_id == ctx.tenant_id)
    )
    api_key = result.scalar_one_or_none()
    if api_key is None:
        raise HTTPException(status_code=404, detail="API key not found")

    api_key.revoked_at = datetime.now(timezone.utc)
    await audit_log(db, ctx.tenant_id, user.id, "revoke_api_key", "api_key", resource_id=str(key_id))
    await db.flush()
    await db.refresh(api_key)
    return api_key


@router.get("/sso/login")
async def sso_login():
    """Redirect to the configured OIDC provider's authorize endpoint. Works with any
    OIDC-compliant IdP (Auth0, Keycloak, ...) since it's driven by discovery metadata,
    not a vendor SDK. Note: `state` here has no server-side session to bind it to (this
    app is JWT-only, no server sessions), so it is NOT verified on callback -- CSRF
    protection for the SSO flow itself is a real gap flagged here, not silently ignored.
    """
    if not settings.sso_enabled:
        raise HTTPException(status_code=501, detail="SSO is not configured (SSO_ENABLED is false).")

    discovery = await fetch_oidc_discovery(settings.sso_issuer)
    state = secrets.token_urlsafe(16)
    params = {
        "response_type": "code",
        "client_id": settings.sso_client_id,
        "redirect_uri": settings.sso_redirect_uri,
        "scope": "openid email profile",
        "state": state,
    }
    return RedirectResponse(f"{discovery['authorization_endpoint']}?{urlencode(params)}")


def _sso_error_redirect(message: str) -> RedirectResponse:
    # Same "redirect the browser to /login/callback?error=" pattern routers/social_auth.py
    # uses -- this is a full-page redirect flow (the IdP lands the browser here directly),
    # not a fetch() the frontend could catch, so a raw HTTPException would just show the
    # user a bare JSON error page at the API's own origin instead of back inside the app.
    return RedirectResponse(f"{settings.frontend_url.rstrip('/')}/login/callback?{urlencode({'error': message})}")


@router.get("/sso/callback")
async def sso_callback(code: str, db: AsyncSession = Depends(get_db)):
    """Exchange the authorization code, fetch the IdP's userinfo, and log in the
    matching User by email.

    Deliberate limitation, not a bug: this app's users are unique per (tenant, email),
    not globally, so a bare email from the IdP cannot always be resolved to a single
    account. Zero matches -> no auto-provisioning across tenants; multiple matches ->
    ambiguous (same email in >1 tenant). Solving this properly needs a real per-tenant
    SSO config or domain-based tenant resolution, which is a product decision, not
    something to silently guess at here.

    On success, redirects to the frontend's /login/callback with a short-lived exchange
    code (same mechanism routers/social_auth.py uses) rather than returning the session
    token as raw JSON -- this is what actually logs the browser into the app instead of
    just displaying a token nobody can use.
    """
    if not settings.sso_enabled:
        return _sso_error_redirect("SSO is not configured (SSO_ENABLED is false).")

    discovery = await fetch_oidc_discovery(settings.sso_issuer)
    tokens = await exchange_code_for_tokens(
        discovery["token_endpoint"], code,
        settings.sso_client_id, settings.sso_client_secret, settings.sso_redirect_uri,
    )
    userinfo = await fetch_userinfo(discovery["userinfo_endpoint"], tokens["access_token"])
    email = userinfo.get("email")
    if not email:
        return _sso_error_redirect("IdP did not return an 'email' claim.")

    result = await db.execute(select(User).where(User.email == email, User.is_active.is_(True)))
    matches = result.scalars().all()
    if not matches:
        return _sso_error_redirect(f"No account provisioned for {email}. SSO does not auto-provision users.")
    if len(matches) > 1:
        return _sso_error_redirect(
            f"{email} matches accounts in multiple tenants; SSO login is ambiguous. Use password login instead."
        )

    user = matches[0]
    exchange_code = create_oauth_exchange_code(user.id, user.tenant_id, user.role)
    return RedirectResponse(f"{settings.frontend_url.rstrip('/')}/login/callback?{urlencode({'code': exchange_code})}")
