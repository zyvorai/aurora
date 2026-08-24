"""Unit tests for Aurora trial / license-key validation (no DB required)."""

from datetime import date, timedelta

from gtm_api.services import licensing


def test_mint_and_parse_valid_key():
    key = licensing.mint_key("Acme Corp", days=30)
    ok, who, exp = licensing.parse_license_key(key)
    assert ok is True
    assert who == "Acme Corp"
    assert exp == (date.today() + timedelta(days=30)).isoformat()


def test_reject_tampered_key():
    key = licensing.mint_key("Acme", days=30)
    payload, sig = key.split(".", 1)
    bad = f"{payload}.{sig[:-2]}xx"
    ok, who, exp = licensing.parse_license_key(bad)
    assert ok is False
    assert who is None
    assert exp is None


def test_reject_expired_key():
    key = licensing.mint_key("Acme", days=30, issued=date.today() - timedelta(days=60))
    ok, _, _ = licensing.parse_license_key(key)
    assert ok is False


def test_reject_wrong_product_payload():
    # Forge-shaped key with wrong product id must not unlock Aurora.
    import base64
    import hashlib
    import hmac
    import json

    payload = json.dumps(
        {"p": "forge", "iss": date.today().isoformat(), "exp": (date.today() + timedelta(days=30)).isoformat(), "who": "x"},
        separators=(",", ":"),
    ).encode()
    b64 = base64.urlsafe_b64encode(payload).rstrip(b"=").decode()
    sig = hmac.new(licensing._HMAC_SECRET, b64.encode(), hashlib.sha256).digest()
    key = f"{b64}.{base64.urlsafe_b64encode(sig).rstrip(b'=').decode()}"
    ok, _, _ = licensing.parse_license_key(key)
    assert ok is False


def test_empty_key():
    assert licensing.parse_license_key("") == (False, None, None)
    assert licensing.parse_license_key(None) == (False, None, None)
