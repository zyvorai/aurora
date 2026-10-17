"""Generic OIDC SSO: protocol plumbing (services/sso.py) and the /auth/sso/* routes,
including the deliberate multi-tenant-email-ambiguity behavior (404/409)."""

import uuid
from urllib.parse import unquote_plus
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from gtm_api.database import get_db
from gtm_api.main import app
from gtm_api.models import User
from gtm_api.services.sso import exchange_code_for_tokens, fetch_oidc_discovery, fetch_userinfo

DISCOVERY = {
    "authorization_endpoint": "https://idp.example.com/authorize",
    "token_endpoint": "https://idp.example.com/token",
    "userinfo_endpoint": "https://idp.example.com/userinfo",
}


def _mock_get_client(json_body):
    response = MagicMock()
    response.json = MagicMock(return_value=json_body)
    response.raise_for_status = MagicMock()

    client = AsyncMock()
    client.get = AsyncMock(return_value=response)
    client.post = AsyncMock(return_value=response)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=False)
    return client


class TestSsoProtocolHelpers:
    @pytest.mark.asyncio
    async def test_fetch_oidc_discovery_hits_well_known_url(self):
        client = _mock_get_client(DISCOVERY)
        with patch("gtm_api.services.sso.httpx.AsyncClient", return_value=client):
            result = await fetch_oidc_discovery("https://idp.example.com")

        assert result == DISCOVERY
        client.get.assert_awaited_once_with("https://idp.example.com/.well-known/openid-configuration")

    @pytest.mark.asyncio
    async def test_exchange_code_for_tokens_posts_authorization_code_grant(self):
        client = _mock_get_client({"access_token": "at123"})
        with patch("gtm_api.services.sso.httpx.AsyncClient", return_value=client):
            result = await exchange_code_for_tokens(
                "https://idp.example.com/token", "code123", "cid", "secret", "https://app/cb"
            )

        assert result == {"access_token": "at123"}
        sent = client.post.call_args.kwargs["data"]
        assert sent["grant_type"] == "authorization_code"
        assert sent["code"] == "code123"

    @pytest.mark.asyncio
    async def test_fetch_userinfo_sends_bearer_token(self):
        client = _mock_get_client({"email": "a@example.com"})
        with patch("gtm_api.services.sso.httpx.AsyncClient", return_value=client):
            result = await fetch_userinfo("https://idp.example.com/userinfo", "at123")

        assert result == {"email": "a@example.com"}
        headers = client.get.call_args.kwargs["headers"]
        assert headers["Authorization"] == "Bearer at123"


class TestSsoRoutes:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_login_returns_501_when_disabled(self, monkeypatch):
        from gtm_api.routers import auth as auth_router

        monkeypatch.setattr(auth_router.settings, "sso_enabled", False)
        with TestClient(app) as client:
            response = client.get("/api/v1/auth/sso/login", follow_redirects=False)
        assert response.status_code == 501

    def test_login_redirects_to_idp_authorize_endpoint_when_enabled(self, monkeypatch):
        from gtm_api.routers import auth as auth_router

        monkeypatch.setattr(auth_router.settings, "sso_enabled", True)
        monkeypatch.setattr(auth_router.settings, "sso_issuer", "https://idp.example.com")
        monkeypatch.setattr(auth_router.settings, "sso_client_id", "cid")
        monkeypatch.setattr(auth_router.settings, "sso_redirect_uri", "https://app.example.com/cb")

        with patch("gtm_api.routers.auth.fetch_oidc_discovery", AsyncMock(return_value=DISCOVERY)):
            with TestClient(app) as client:
                response = client.get("/api/v1/auth/sso/login", follow_redirects=False)

        assert response.status_code in (302, 307)
        assert response.headers["location"].startswith("https://idp.example.com/authorize?")

    def test_callback_redirects_with_error_when_disabled(self, monkeypatch):
        from gtm_api.routers import auth as auth_router

        monkeypatch.setattr(auth_router.settings, "sso_enabled", False)
        with TestClient(app) as client:
            response = client.get("/api/v1/auth/sso/callback", params={"code": "x"}, follow_redirects=False)
        # A full-page redirect flow: errors send the browser back into the app, not a bare JSON error page.
        assert response.status_code in (302, 307)
        assert "/login/callback?error=" in response.headers["location"]
        assert "SSO_ENABLED" in unquote_plus(response.headers["location"])

    def test_callback_redirects_with_error_when_no_account_matches_email(self, monkeypatch):
        from gtm_api.routers import auth as auth_router

        monkeypatch.setattr(auth_router.settings, "sso_enabled", True)
        monkeypatch.setattr(auth_router.settings, "sso_issuer", "https://idp.example.com")

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [])))

        async def _get_db():
            yield mock_db

        app.dependency_overrides[get_db] = _get_db

        with (
            patch("gtm_api.routers.auth.fetch_oidc_discovery", AsyncMock(return_value=DISCOVERY)),
            patch("gtm_api.routers.auth.exchange_code_for_tokens", AsyncMock(return_value={"access_token": "at"})),
            patch("gtm_api.routers.auth.fetch_userinfo", AsyncMock(return_value={"email": "nouser@example.com"})),
        ):
            with TestClient(app) as client:
                response = client.get("/api/v1/auth/sso/callback", params={"code": "x"}, follow_redirects=False)

        assert response.status_code in (302, 307)
        loc = unquote_plus(response.headers["location"])
        assert "/login/callback?error=" in loc and "No account provisioned for nouser@example.com" in loc

    def test_callback_redirects_with_error_when_email_ambiguous_across_tenants(self, monkeypatch):
        from gtm_api.routers import auth as auth_router

        monkeypatch.setattr(auth_router.settings, "sso_enabled", True)
        monkeypatch.setattr(auth_router.settings, "sso_issuer", "https://idp.example.com")

        dupes = [
            User(id=uuid.uuid4(), tenant_id=uuid.uuid4(), email="dupe@example.com", hashed_password="x", role="admin"),
            User(id=uuid.uuid4(), tenant_id=uuid.uuid4(), email="dupe@example.com", hashed_password="x", role="viewer"),
        ]
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: dupes)))

        async def _get_db():
            yield mock_db

        app.dependency_overrides[get_db] = _get_db

        with (
            patch("gtm_api.routers.auth.fetch_oidc_discovery", AsyncMock(return_value=DISCOVERY)),
            patch("gtm_api.routers.auth.exchange_code_for_tokens", AsyncMock(return_value={"access_token": "at"})),
            patch("gtm_api.routers.auth.fetch_userinfo", AsyncMock(return_value={"email": "dupe@example.com"})),
        ):
            with TestClient(app) as client:
                response = client.get("/api/v1/auth/sso/callback", params={"code": "x"}, follow_redirects=False)

        assert response.status_code in (302, 307)
        loc = unquote_plus(response.headers["location"])
        assert "/login/callback?error=" in loc and "multiple tenants" in loc

    def test_callback_redirects_with_exchange_code_for_single_match(self, monkeypatch):
        from gtm_api.routers import auth as auth_router

        monkeypatch.setattr(auth_router.settings, "sso_enabled", True)
        monkeypatch.setattr(auth_router.settings, "sso_issuer", "https://idp.example.com")

        tenant_id = uuid.uuid4()
        user = User(
            id=uuid.uuid4(), tenant_id=tenant_id, email="ok@example.com",
            hashed_password="x", role="editor", is_active=True,
        )
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [user])))

        async def _get_db():
            yield mock_db

        app.dependency_overrides[get_db] = _get_db

        with (
            patch("gtm_api.routers.auth.fetch_oidc_discovery", AsyncMock(return_value=DISCOVERY)),
            patch("gtm_api.routers.auth.exchange_code_for_tokens", AsyncMock(return_value={"access_token": "at"})),
            patch("gtm_api.routers.auth.fetch_userinfo", AsyncMock(return_value={"email": "ok@example.com"})),
        ):
            with TestClient(app) as client:
                response = client.get("/api/v1/auth/sso/callback", params={"code": "x"}, follow_redirects=False)

        # Success redirects into the app with a short-lived exchange code (not the raw token as JSON).
        assert response.status_code in (302, 307)
        loc = response.headers["location"]
        assert "/login/callback?code=" in loc and "error=" not in loc
