"""Encrypt/decrypt credentials for external sources (GitHub, database)."""

from __future__ import annotations

import base64
import hashlib
import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from gtm_api.config import get_settings


def _fernet() -> Fernet:
    settings = get_settings()
    key = base64.urlsafe_b64encode(
        hashlib.sha256(settings.secret_key.encode()).digest()
    )
    return Fernet(key)


def encrypt_secret(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload).encode()
    return _fernet().encrypt(raw).decode()


def decrypt_secret(token: str) -> dict[str, Any]:
    try:
        raw = _fernet().decrypt(token.encode())
        return json.loads(raw.decode())
    except (InvalidToken, json.JSONDecodeError) as exc:
        raise ValueError("Invalid credential token") from exc
