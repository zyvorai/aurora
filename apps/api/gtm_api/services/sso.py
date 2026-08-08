"""Generic OIDC SSO protocol plumbing -- works with Auth0, Keycloak, or any
OIDC-compliant IdP, since it drives everything off standard discovery metadata
(`/.well-known/openid-configuration`) rather than a vendor-specific SDK.

This module handles the OAuth2/OIDC protocol mechanics only (discovery, authorization
code exchange, userinfo fetch). It deliberately does NOT solve multi-tenant user
provisioning -- see routers/auth.py::sso_callback() for why that's a real product
decision (which tenant does a bare email belong to?) left as an explicit, documented
limitation rather than a silent guess.
"""

import httpx

_TIMEOUT = 10.0


async def fetch_oidc_discovery(issuer: str) -> dict:
    url = issuer.rstrip("/") + "/.well-known/openid-configuration"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()


async def exchange_code_for_tokens(
    token_endpoint: str,
    code: str,
    client_id: str,
    client_secret: str,
    redirect_uri: str,
) -> dict:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.post(
            token_endpoint,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
            },
        )
        response.raise_for_status()
        return response.json()


async def fetch_userinfo(userinfo_endpoint: str, access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.get(
            userinfo_endpoint, headers={"Authorization": f"Bearer {access_token}"}
        )
        response.raise_for_status()
        return response.json()
