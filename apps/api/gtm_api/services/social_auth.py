"""Consumer social login (Google/GitHub) OAuth2 protocol plumbing.

Distinct from services/sso.py's generic OIDC helpers: that module authenticates
*existing* users against one operator-configured enterprise IdP and never creates
accounts. This module is provider-specific (GitHub has no OIDC discovery document,
so its endpoints are hardcoded) and its callers auto-provision a new tenant on first
sign-in -- see routers/social_auth.py.
"""

import httpx

_TIMEOUT = 10.0

GOOGLE_AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"

GITHUB_AUTHORIZE_ENDPOINT = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token"
GITHUB_USER_ENDPOINT = "https://api.github.com/user"
GITHUB_USER_EMAILS_ENDPOINT = "https://api.github.com/user/emails"
_GITHUB_USER_AGENT = "Aurora-App"


class SocialAuthError(Exception):
    """Raised for any failure exchanging a code or fetching a profile -- callers
    turn this into a redirect-with-?error= rather than a raw 500, since the whole
    flow is a full-page browser redirect, not a fetch() the frontend can catch."""


async def google_exchange_and_fetch_profile(
    code: str, client_id: str, client_secret: str, redirect_uri: str
) -> dict:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_ENDPOINT,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
            },
        )
        if token_resp.status_code >= 400:
            raise SocialAuthError(f"Google token exchange failed: {token_resp.text[:300]}")
        access_token = token_resp.json().get("access_token")
        if not access_token:
            raise SocialAuthError("Google token exchange did not return an access_token.")

        userinfo_resp = await client.get(
            GOOGLE_USERINFO_ENDPOINT, headers={"Authorization": f"Bearer {access_token}"}
        )
        if userinfo_resp.status_code >= 400:
            raise SocialAuthError(f"Google userinfo fetch failed: {userinfo_resp.text[:300]}")
        info = userinfo_resp.json()

    email = info.get("email")
    if not email:
        raise SocialAuthError("Google did not return an email claim.")
    return {
        "subject": info.get("sub"),
        "email": email,
        "email_verified": bool(info.get("email_verified")),
        "full_name": info.get("name") or "",
    }


async def github_exchange_and_fetch_profile(
    code: str, client_id: str, client_secret: str, redirect_uri: str
) -> dict:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        token_resp = await client.post(
            GITHUB_TOKEN_ENDPOINT,
            headers={"Accept": "application/json"},
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
            },
        )
        if token_resp.status_code >= 400:
            raise SocialAuthError(f"GitHub token exchange failed: {token_resp.text[:300]}")
        token_body = token_resp.json()
        access_token = token_body.get("access_token")
        if not access_token:
            raise SocialAuthError(
                f"GitHub token exchange did not return an access_token: {token_body.get('error_description', token_body)}"
            )

        auth_header = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": _GITHUB_USER_AGENT,
        }
        user_resp = await client.get(GITHUB_USER_ENDPOINT, headers=auth_header)
        if user_resp.status_code >= 400:
            raise SocialAuthError(f"GitHub user fetch failed: {user_resp.text[:300]}")
        user = user_resp.json()

        # /user.email (even when public) carries no separate verified flag -- always
        # cross-check against /user/emails, which does, rather than trusting presence
        # alone (requires the user:email scope, which the authorize request requests).
        email = None
        emails_resp = await client.get(GITHUB_USER_EMAILS_ENDPOINT, headers=auth_header)
        if emails_resp.status_code < 400:
            for entry in emails_resp.json():
                if entry.get("primary") and entry.get("verified"):
                    email = entry.get("email")
                    break

    if not email:
        raise SocialAuthError(
            "GitHub did not return a verified email address. Make sure your GitHub "
            "account has a verified primary email (Settings > Emails)."
        )
    return {
        "subject": str(user.get("id")),
        "email": email,
        "email_verified": True,
        "full_name": user.get("name") or user.get("login") or "",
    }
