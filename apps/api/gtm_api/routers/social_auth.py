"""Consumer social login: Sign in with Google / Sign in with GitHub.

Distinct from the enterprise SSO routes in routers/auth.py (`/auth/sso/*`), which
authenticate an existing user by email against one operator-configured IdP and
never create accounts. These routes auto-provision a brand-new tenant + admin user
on first sign-in, matching how /auth/register works today, since there's no
"join an existing tenant by invite" flow yet -- see the account-resolution helper
below for the exact rules.

CSRF: state is a random token round-tripped through a short-lived HttpOnly cookie
(set on /start, checked on /callback) rather than a server-side session store, since
this app is otherwise JWT-only. This closes the CSRF gap that routers/auth.py's
sso_login/sso_callback explicitly documents as unsolved for the enterprise flow.
"""

import secrets
import uuid
from urllib.parse import urlencode

from fastapi import APIRouter, Cookie, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import create_access_token, create_oauth_exchange_code, resolve_oauth_exchange_code, slugify
from gtm_api.config import get_settings
from gtm_api.database import get_db
from gtm_api.models import PlanTier, Tenant, User
from gtm_api.schemas import TokenResponse
from gtm_api.services.social_auth import (
    GITHUB_AUTHORIZE_ENDPOINT,
    GOOGLE_AUTHORIZE_ENDPOINT,
    SocialAuthError,
    github_exchange_and_fetch_profile,
    google_exchange_and_fetch_profile,
)
from gtm_api.tenant import audit_log

settings = get_settings()
router = APIRouter(prefix="/auth/oauth", tags=["social-auth"])

_STATE_COOKIE = "oauth_state"
_GENERIC_EMAIL_DOMAINS = {
    "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
    "yahoo.com", "icloud.com", "me.com", "aol.com", "protonmail.com",
}


def _cookies_secure() -> bool:
    # Secure cookies require HTTPS -- api_base_url is http:// for local dev, https://
    # in production (behind the Cloudflare/proxy TLS termination this app already runs
    # under), so derive the flag instead of hardcoding it and breaking local testing.
    return settings.api_base_url.startswith("https://")


def _redirect_uri(provider: str) -> str:
    return f"{settings.api_base_url.rstrip('/')}{settings.api_prefix}/auth/oauth/{provider}/callback"


def _error_redirect(message: str) -> RedirectResponse:
    return RedirectResponse(f"{settings.frontend_url.rstrip('/')}/login/callback?{urlencode({'error': message})}")


def _success_redirect(user_id: uuid.UUID, tenant_id: uuid.UUID, role: str) -> RedirectResponse:
    # A short-lived, single-purpose exchange code travels in the URL instead of the real
    # session token -- bounds exposure if it ends up in proxy/CDN access logs, and can't
    # be used as a Bearer token directly even if intercepted. See create_oauth_exchange_code.
    code = create_oauth_exchange_code(user_id, tenant_id, role)
    resp = RedirectResponse(f"{settings.frontend_url.rstrip('/')}/login/callback?{urlencode({'code': code})}")
    resp.delete_cookie(_STATE_COOKIE)
    return resp


class OAuthExchangeRequest(BaseModel):
    code: str


@router.post("/exchange", response_model=TokenResponse)
async def oauth_exchange(req: OAuthExchangeRequest, db: AsyncSession = Depends(get_db)):
    """Trades a one-time exchange code (from the /login/callback redirect) for a real
    session token. Kept separate from create_access_token's normal token so the code
    itself is useless as a Bearer credential even if it leaks."""
    resolved = resolve_oauth_exchange_code(req.code)
    if resolved is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired sign-in code.")
    user_id, tenant_id, role = resolved

    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer available.")

    token = create_access_token(user.id, user.tenant_id, user.role)
    return TokenResponse(access_token=token, tenant_id=user.tenant_id, user_id=user.id, role=user.role)


def _tenant_name_for_email(email: str, full_name: str) -> str:
    domain = email.rsplit("@", 1)[-1].lower()
    if domain in _GENERIC_EMAIL_DOMAINS or "." not in domain:
        who = full_name.strip() or email.split("@", 1)[0]
        return f"{who}'s Workspace"
    label = domain.split(".")[0]
    return label.replace("-", " ").replace("_", " ").title()


async def _resolve_or_provision_user(
    db: AsyncSession, provider: str, profile: dict
) -> tuple[User | None, str | None]:
    """Returns (user, error_message) -- exactly one is set."""
    if not profile["email_verified"]:
        return None, f"{provider.title()} did not report a verified email address."

    subject = profile["subject"]
    email = profile["email"]

    result = await db.execute(
        select(User).where(
            User.oauth_provider == provider, User.oauth_subject == subject, User.is_active.is_(True)
        )
    )
    user = result.scalar_one_or_none()
    if user is not None:
        return user, None

    result = await db.execute(select(User).where(User.email == email, User.is_active.is_(True)))
    matches = result.scalars().all()
    if len(matches) > 1:
        return None, f"{email} matches accounts in multiple workspaces; sign in with a password instead."
    if len(matches) == 1:
        # Provider already verified this email belongs to whoever is signing in --
        # safe to link this identity onto the existing password (or other-provider) account.
        user = matches[0]
        user.oauth_provider = provider
        user.oauth_subject = subject
        await db.flush()
        return user, None

    # No existing account for this identity or email -- provision a fresh tenant,
    # same shape as POST /auth/register.
    tenant_name = _tenant_name_for_email(email, profile["full_name"])
    slug = slugify(tenant_name)
    existing_slug = await db.execute(select(Tenant).where(Tenant.slug == slug))
    if existing_slug.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    tenant = Tenant(name=tenant_name, slug=slug, plan=PlanTier.STARTER)
    db.add(tenant)
    await db.flush()

    user = User(
        tenant_id=tenant.id,
        email=email,
        hashed_password=None,
        full_name=profile["full_name"],
        role="admin",
        oauth_provider=provider,
        oauth_subject=subject,
    )
    db.add(user)
    await db.flush()
    await audit_log(db, tenant.id, user.id, "register", "tenant", details={"via": f"oauth:{provider}"})
    return user, None


@router.get("/google/start")
async def google_start():
    if not settings.google_oauth_configured:
        return _error_redirect("Google sign-in is not configured yet.")
    state = secrets.token_urlsafe(24)
    params = {
        "response_type": "code",
        "client_id": settings.google_client_id,
        "redirect_uri": _redirect_uri("google"),
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    resp = RedirectResponse(f"{GOOGLE_AUTHORIZE_ENDPOINT}?{urlencode(params)}")
    resp.set_cookie(_STATE_COOKIE, state, max_age=600, httponly=True, secure=_cookies_secure(), samesite="lax")
    return resp


@router.get("/google/callback")
async def google_callback(
    code: str,
    state: str,
    oauth_state: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not settings.google_oauth_configured:
        return _error_redirect("Google sign-in is not configured yet.")
    if not oauth_state or not secrets.compare_digest(oauth_state, state):
        return _error_redirect("Sign-in session expired or invalid. Please try again.")

    try:
        profile = await google_exchange_and_fetch_profile(
            code, settings.google_client_id, settings.google_client_secret, _redirect_uri("google")
        )
    except SocialAuthError as exc:
        return _error_redirect(str(exc))

    try:
        user, error = await _resolve_or_provision_user(db, "google", profile)
        if error:
            return _error_redirect(error)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return _error_redirect("Sign-in conflict, please try again.")
    return _success_redirect(user.id, user.tenant_id, user.role)


@router.get("/github/start")
async def github_start():
    if not settings.github_oauth_configured:
        return _error_redirect("GitHub sign-in is not configured yet.")
    state = secrets.token_urlsafe(24)
    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": _redirect_uri("github"),
        "scope": "read:user user:email",
        "state": state,
    }
    resp = RedirectResponse(f"{GITHUB_AUTHORIZE_ENDPOINT}?{urlencode(params)}")
    resp.set_cookie(_STATE_COOKIE, state, max_age=600, httponly=True, secure=_cookies_secure(), samesite="lax")
    return resp


@router.get("/github/callback")
async def github_callback(
    code: str,
    state: str,
    oauth_state: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not settings.github_oauth_configured:
        return _error_redirect("GitHub sign-in is not configured yet.")
    if not oauth_state or not secrets.compare_digest(oauth_state, state):
        return _error_redirect("Sign-in session expired or invalid. Please try again.")

    try:
        profile = await github_exchange_and_fetch_profile(
            code, settings.github_client_id, settings.github_client_secret, _redirect_uri("github")
        )
    except SocialAuthError as exc:
        return _error_redirect(str(exc))

    try:
        user, error = await _resolve_or_provision_user(db, "github", profile)
        if error:
            return _error_redirect(error)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return _error_redirect("Sign-in conflict, please try again.")
    return _success_redirect(user.id, user.tenant_id, user.role)
