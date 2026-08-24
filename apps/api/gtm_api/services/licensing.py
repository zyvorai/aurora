"""Keyless 30-day trial + signed license-key gating.

With no valid ``AURORA_LICENSE_KEY`` (Helm: ``license.key`` /
``license.existingSecret``), the deployment runs fully for ``TRIAL_DAYS`` from
its first database write to ``license_state``. Once that window elapses without
a key, middleware returns HTTP 402 until a key from sales@zyvor.dev is set.

Keys are HMAC-signed payloads (same shape as Forge / IronWolf):

    <base64url-json>.<base64url-hmac>
    {"p":"aurora","iss":"YYYY-MM-DD","exp":"YYYY-MM-DD","who":"Acme Corp"}

Generate with ``scripts/gen-trial-key.py`` (keep that script confidential).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import LicenseState

TRIAL_DAYS = 30
PRODUCT = "aurora"
# Must match scripts/gen-trial-key.py — confidential to Zyvor sales tooling.
_HMAC_SECRET = b"zyvor-aurora-trial-v1-7c9e2a4f6b8d0e1f3a5c7d9e"

SALES_EMAIL = "sales@zyvor.dev"
EXPIRED_MESSAGE = (
    "Your 30-day Aurora trial has ended. Set AURORA_LICENSE_KEY "
    "(or the Helm chart's license.key / license.existingSecret) to continue — "
    f"email {SALES_EMAIL} for a license key."
)


class LicenseError(RuntimeError):
    pass


@dataclass(frozen=True)
class LicenseStatus:
    licensed: bool
    trial_active: bool
    trial_expired: bool
    trial_days_remaining: int
    first_seen_at: datetime
    licensee: str | None
    key_expires_at: str | None
    contact: str = SALES_EMAIL

    def as_dict(self) -> dict:
        return {
            "licensed": self.licensed,
            "trial_active": self.trial_active,
            "trial_expired": self.trial_expired,
            "trial_days_remaining": self.trial_days_remaining,
            "first_seen_at": self.first_seen_at.isoformat(),
            "licensee": self.licensee,
            "key_expires_at": self.key_expires_at,
            "contact": self.contact,
        }


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def parse_license_key(raw: str | None) -> tuple[bool, str | None, str | None]:
    """Return (valid, licensee, key_expires_iso_or_none)."""
    if not raw or not raw.strip():
        return False, None, None
    key = raw.strip()
    try:
        payload_b64, sig_b64 = key.split(".", 1)
    except ValueError:
        return False, None, None
    expected = hmac.new(_HMAC_SECRET, payload_b64.encode(), hashlib.sha256).digest()
    try:
        got = _b64url_decode(sig_b64)
    except Exception:
        return False, None, None
    if not hmac.compare_digest(expected, got):
        return False, None, None
    try:
        payload = json.loads(_b64url_decode(payload_b64))
    except Exception:
        return False, None, None
    if payload.get("p") != PRODUCT:
        return False, None, None
    exp_s = payload.get("exp")
    if not exp_s:
        return False, None, None
    try:
        exp = date.fromisoformat(exp_s)
    except ValueError:
        return False, None, None
    if exp < date.today():
        return False, None, None
    return True, str(payload.get("who") or "") or None, exp.isoformat()


async def _first_seen_at(db: AsyncSession) -> datetime:
    row = (
        await db.execute(select(LicenseState).where(LicenseState.id == 1))
    ).scalar_one_or_none()
    if row is not None:
        ts = row.first_seen_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return ts

    now = datetime.now(timezone.utc)
    db.add(LicenseState(id=1, first_seen_at=now))
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        row = (
            await db.execute(select(LicenseState).where(LicenseState.id == 1))
        ).scalar_one_or_none()
        if row is None:
            raise
        ts = row.first_seen_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return ts
    return now


async def status(db: AsyncSession, license_key: str | None) -> LicenseStatus:
    valid, licensee, key_exp = parse_license_key(license_key)
    first_seen = await _first_seen_at(db)
    elapsed_days = max(0, (datetime.now(timezone.utc) - first_seen).days)
    remaining = max(0, TRIAL_DAYS - elapsed_days)
    trial_expired = not valid and elapsed_days >= TRIAL_DAYS
    return LicenseStatus(
        licensed=valid,
        trial_active=not valid and not trial_expired,
        trial_expired=trial_expired,
        trial_days_remaining=remaining,
        first_seen_at=first_seen,
        licensee=licensee if valid else None,
        key_expires_at=key_exp if valid else None,
    )


async def require_active(db: AsyncSession, license_key: str | None) -> LicenseStatus:
    st = await status(db, license_key)
    if st.trial_expired:
        raise LicenseError(EXPIRED_MESSAGE)
    return st


def mint_key(licensee: str, days: int = 365, issued: date | None = None) -> str:
    """Sales-side helper (also used by unit tests). Prefer scripts/gen-trial-key.py."""
    today = issued or date.today()
    expiry = today + timedelta(days=days)
    payload = json.dumps(
        {"p": PRODUCT, "iss": today.isoformat(), "exp": expiry.isoformat(), "who": licensee},
        separators=(",", ":"),
    ).encode()
    payload_b64 = _b64url_encode(payload)
    sig = hmac.new(_HMAC_SECRET, payload_b64.encode(), hashlib.sha256).digest()
    return f"{payload_b64}.{_b64url_encode(sig)}"
