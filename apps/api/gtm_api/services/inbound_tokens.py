"""Deterministic inbound embed tokens — no DB column required."""

from __future__ import annotations

import hashlib
import hmac
import secrets

from gtm_api.config import get_settings


def inbound_token(product_id: str) -> str:
    settings = get_settings()
    digest = hmac.new(
        settings.secret_key.encode(),
        f"inbound:{product_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return digest[:32]


def verify_inbound_token(product_id: str, token: str) -> bool:
    if not token:
        return False
    return secrets.compare_digest(inbound_token(product_id), token.strip())
