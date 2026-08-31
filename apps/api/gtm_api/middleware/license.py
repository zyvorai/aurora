"""Starlette middleware: block product APIs once the keyless trial expires."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from gtm_api.config import get_settings
from gtm_api.database import async_session_factory
from gtm_api.services import licensing

# Paths that must stay reachable after trial expiry (status + health + auth so
# operators can still sign in and see the banner / apply a key via env restart).
_ALWAYS_ALLOW_PREFIXES = (
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
)


def _allowed(path: str, api_prefix: str) -> bool:
    if any(path == p or path.startswith(p + "/") for p in _ALWAYS_ALLOW_PREFIXES):
        return True
    license_status = f"{api_prefix}/license/status"
    if path == license_status or path.startswith(license_status + "/"):
        return True
    # Auth + portal login/signup stay open so expired installs can still reach UI.
    for suffix in (
        "/auth/login",
        "/auth/register",
        "/auth/sso/login",
        "/auth/sso/callback",
        "/auth/oauth/",
        "/portal/",
        "/public/",
    ):
        if path.startswith(f"{api_prefix}{suffix}") or path == f"{api_prefix}{suffix.rstrip('/')}":
            return True
    return False


class LicenseMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        settings = get_settings()
        if not settings.aurora_license_enforce:
            return await call_next(request)

        path = request.url.path
        if _allowed(path, settings.api_prefix):
            return await call_next(request)

        # Only gate API product routes — leave Next.js / static alone if ever proxied.
        if not path.startswith(settings.api_prefix):
            return await call_next(request)

        try:
            async with async_session_factory() as db:
                await licensing.require_active(db, settings.aurora_license_key or None)
        except licensing.LicenseError as exc:
            return JSONResponse(
                status_code=402,
                content={
                    "detail": str(exc),
                    "contact": licensing.SALES_EMAIL,
                    "trial_expired": True,
                },
            )
        except Exception:
            # Don't hard-crash the whole API if license_state isn't migrated yet —
            # degraded installs should still boot; operators see /license/status.
            pass

        return await call_next(request)
