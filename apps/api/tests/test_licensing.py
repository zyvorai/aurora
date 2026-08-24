"""Unit tests for Aurora Ed25519 signed trial tokens (no DB required)."""

from datetime import datetime, timedelta, timezone

import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from gtm_api.services import licensing


def _ephemeral(monkeypatch):
    key = Ed25519PrivateKey.generate()
    pub = key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
    import base64

    monkeypatch.setattr(
        licensing,
        "TRIAL_PUBLIC_KEY_B64",
        base64.b64encode(pub).decode(),
    )
    return key


def _mint(key: Ed25519PrivateKey, who: str, *, days: int = 30, expired: bool = False) -> str:
    now = datetime.now(tz=timezone.utc)
    if expired:
        iat = now - timedelta(days=60)
        exp = now - timedelta(days=30)
    else:
        iat = now
        exp = now + timedelta(days=days)
    claims = {
        "sub": who,
        "iat": int(iat.timestamp()),
        "exp": int(exp.timestamp()),
        "product": licensing.PRODUCT_TAG,
    }
    return jwt.encode(claims, key, algorithm="EdDSA")


def test_mint_and_parse_valid_key(monkeypatch):
    key = _ephemeral(monkeypatch)
    token = _mint(key, "Acme Corp", days=30)
    ok, who, exp = licensing.parse_license_key(token)
    assert ok is True
    assert who == "Acme Corp"
    assert exp is not None


def test_reject_tampered_key(monkeypatch):
    key = _ephemeral(monkeypatch)
    token = _mint(key, "Acme", days=30)
    bad = token[:-4] + "xxxx"
    ok, who, exp = licensing.parse_license_key(bad)
    assert ok is False
    assert who is None
    assert exp is None


def test_reject_expired_key(monkeypatch):
    key = _ephemeral(monkeypatch)
    token = _mint(key, "Acme", expired=True)
    ok, _, _ = licensing.parse_license_key(token)
    assert ok is False


def test_reject_wrong_product(monkeypatch):
    key = _ephemeral(monkeypatch)
    now = datetime.now(tz=timezone.utc)
    claims = {
        "sub": "x",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=30)).timestamp()),
        "product": "veyron-trial",
    }
    token = jwt.encode(claims, key, algorithm="EdDSA")
    ok, _, _ = licensing.parse_license_key(token)
    assert ok is False


def test_empty_key():
    assert licensing.parse_license_key("") == (False, None, None)
    assert licensing.parse_license_key(None) == (False, None, None)
