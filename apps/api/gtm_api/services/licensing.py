"""Signed trial token enforcement — Ed25519 JWT, no server clock.

Matches Veyron's design (``veyron/src/trial.rs``):

* Evaluation builds require a cryptographically signed ``trial.token``
  (or ``AURORA_TRIAL_TOKEN`` / ``AURORA_LICENSE_KEY`` env).
* The package only embeds the **public** key. Private key lives in
  ``secrets/`` and is used by ``scripts/trial-tool.py`` (sales / packaging).
* Expiry is inside the token (``exp`` claim). There is no ``first_seen_at``
  database clock — deleting local state cannot extend a trial.
* Product tag ``aurora-trial`` prevents cross-product token reuse.

Issue a 30-day evaluation token when building the customer package; after
expiry customers email sales@zyvor.dev for a renewed signed token.
"""

from __future__ import annotations

import base64
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import load_pem_private_key

TRIAL_DAYS_DEFAULT = 30
PRODUCT_TAG = "aurora-trial"
SALES_EMAIL = "sales@zyvor.dev"

# Raw Ed25519 public key (32 bytes), standard base64. Rotate via
# ``python3 scripts/trial-tool.py keygen`` and paste the new value here.
TRIAL_PUBLIC_KEY_B64 = "ankjJniF/KhRsMyF8JEt/FOJhJfKRsUaNaZ3pOASgOU="

EXPIRED_MESSAGE = (
    "Your Aurora evaluation token is missing, invalid, or expired. "
    f"Email {SALES_EMAIL} for a signed trial.token / license renewal."
)


class LicenseError(RuntimeError):
    pass


@dataclass(frozen=True)
class LicenseStatus:
    licensed: bool
    trial_active: bool
    trial_expired: bool
    trial_days_remaining: int
    licensee: str | None
    key_expires_at: str | None
    contact: str = SALES_EMAIL
    enforced: bool = True

    def as_dict(self) -> dict:
        return {
            "licensed": self.licensed,
            "trial_active": self.trial_active,
            "trial_expired": self.trial_expired,
            "trial_days_remaining": self.trial_days_remaining,
            "licensee": self.licensee,
            "key_expires_at": self.key_expires_at,
            "contact": self.contact,
            "enforced": self.enforced,
            "design": "signed-trial-token",
        }


def _public_key() -> Ed25519PublicKey:
    raw = base64.b64decode(TRIAL_PUBLIC_KEY_B64)
    if len(raw) != 32:
        raise LicenseError("embedded trial public key is corrupt")
    return Ed25519PublicKey.from_public_bytes(raw)


def locate_token(explicit: str | None = None) -> str | None:
    for candidate in (
        explicit,
        os.environ.get("AURORA_TRIAL_TOKEN"),
        os.environ.get("AURORA_LICENSE_KEY"),
    ):
        if candidate and candidate.strip():
            return candidate.strip()
    for path in (
        Path(os.environ["AURORA_TRIAL_TOKEN_FILE"])
        if os.environ.get("AURORA_TRIAL_TOKEN_FILE")
        else None,
        Path("/app/trial.token"),
        Path("trial.token"),
        Path.home() / ".config" / "aurora" / "trial.token",
    ):
        if path is not None and path.is_file():
            text = path.read_text().strip()
            if text:
                return text
    return None


def verify_token(token: str) -> dict:
    """Return JWT claims or raise LicenseError."""
    try:
        claims = jwt.decode(
            token.strip(),
            _public_key(),
            algorithms=["EdDSA"],
            options={"require": ["exp", "iat", "sub", "product"]},
        )
    except Exception as exc:  # noqa: BLE001 — surface as license error
        raise LicenseError(f"invalid or expired trial token ({exc})") from exc
    if claims.get("product") != PRODUCT_TAG:
        raise LicenseError("token was not issued for this product")
    return claims


def parse_license_key(raw: str | None) -> tuple[bool, str | None, str | None]:
    """Return (ok, who, exp_iso). Used by tests and status helpers."""
    if not raw or not str(raw).strip():
        return False, None, None
    try:
        claims = verify_token(raw)
    except LicenseError:
        return False, None, None
    exp = claims.get("exp")
    exp_iso = (
        datetime.fromtimestamp(int(exp), tz=timezone.utc).date().isoformat()
        if exp is not None
        else None
    )
    return True, str(claims.get("sub") or "") or None, exp_iso


def status_sync(explicit_token: str | None = None, *, enforce: bool = True) -> LicenseStatus:
    if not enforce:
        return LicenseStatus(
            licensed=True,
            trial_active=False,
            trial_expired=False,
            trial_days_remaining=TRIAL_DAYS_DEFAULT,
            licensee=None,
            key_expires_at=None,
            enforced=False,
        )
    token = locate_token(explicit_token)
    if not token:
        return LicenseStatus(
            licensed=False,
            trial_active=False,
            trial_expired=True,
            trial_days_remaining=0,
            licensee=None,
            key_expires_at=None,
        )
    try:
        claims = verify_token(token)
    except LicenseError:
        return LicenseStatus(
            licensed=False,
            trial_active=False,
            trial_expired=True,
            trial_days_remaining=0,
            licensee=None,
            key_expires_at=None,
        )
    now = datetime.now(tz=timezone.utc).timestamp()
    exp = float(claims["exp"])
    remaining = max(0, int((exp - now) / 86_400))
    expired = now >= exp
    return LicenseStatus(
        licensed=not expired,
        trial_active=not expired,
        trial_expired=expired,
        trial_days_remaining=remaining,
        licensee=str(claims.get("sub") or "") or None,
        key_expires_at=datetime.fromtimestamp(exp, tz=timezone.utc).date().isoformat(),
    )


async def status(_db, license_key: str | None = None, *, enforce: bool | None = None) -> LicenseStatus:
    """DB arg kept for call-site compatibility; unused (no server clock)."""
    if enforce is None:
        enforce = os.environ.get("AURORA_LICENSE_ENFORCE", "true").lower() not in (
            "0",
            "false",
            "no",
        )
    return status_sync(license_key, enforce=enforce)


async def require_active(_db, license_key: str | None = None) -> LicenseStatus:
    st = status_sync(license_key, enforce=True)
    if st.trial_expired or not st.licensed:
        raise LicenseError(EXPIRED_MESSAGE)
    return st


def mint_token(licensee: str, days: int, private_pem: bytes) -> str:
    private = load_pem_private_key(private_pem, password=None)
    now = datetime.now(tz=timezone.utc)
    claims = {
        "sub": licensee,
        "iat": int(now.timestamp()),
        "exp": int(now.timestamp()) + int(days) * 86_400,
        "product": PRODUCT_TAG,
    }
    return jwt.encode(claims, private, algorithm="EdDSA")
