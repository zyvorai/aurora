"""Authentication and authorization utilities."""

import hashlib
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.config import get_settings
from gtm_api.database import get_db
from gtm_api.models import ApiKey, User

settings = get_settings()
# auto_error=False so a request can authenticate via X-API-Key instead of Bearer JWT;
# get_current_user raises the equivalent 401/403 itself when neither is present.
security = HTTPBearer(auto_error=False)

API_KEY_PREFIX = "sk_live_"


def generate_api_key() -> tuple[str, str, str]:
    """Returns (raw_key, key_prefix, key_hash). Only the raw key is ever shown to the
    caller (once, at creation time) — only the hash is persisted."""
    raw_key = API_KEY_PREFIX + secrets.token_urlsafe(32)
    return raw_key, raw_key[: len(API_KEY_PREFIX) + 8], hash_api_key(raw_key)


def hash_api_key(raw_key: str) -> str:
    # API keys are high-entropy random secrets (unlike user passwords), so a fast
    # unsalted digest is an appropriate tradeoff for O(1) lookup-by-hash on every request.
    return hashlib.sha256(raw_key.encode()).hexdigest()

ROLE_PERMISSIONS = {
    "admin": {"read", "write", "approve", "publish", "manage_users", "manage_billing", "manage_tenant"},
    "editor": {"read", "write"},
    "approver": {"read", "write", "approve"},
    "viewer": {"read"},
}


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: uuid.UUID, tenant_id: uuid.UUID, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": str(user_id),
        "tenant_id": str(tenant_id),
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


async def _resolve_api_key(raw_key: str, db: AsyncSession) -> User:
    result = await db.execute(select(ApiKey).where(ApiKey.key_hash == hash_api_key(raw_key)))
    api_key = result.scalar_one_or_none()
    if api_key is None or api_key.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    api_key.last_used_at = datetime.now(timezone.utc)
    # Transient (unpersisted) User standing in for the key's identity — id/role/tenant
    # drive RBAC and audit logging exactly like a JWT-authenticated human user.
    return User(
        id=api_key.id,
        tenant_id=api_key.tenant_id,
        email=f"apikey:{api_key.name}",
        hashed_password="",
        full_name=api_key.name,
        role=api_key.role,
        is_active=True,
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> User:
    if x_api_key:
        return await _resolve_api_key(x_api_key, db)

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authenticated",
        )
    try:
        payload = jwt.decode(
            credentials.credentials, settings.secret_key, algorithms=[settings.algorithm]
        )
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_permission(permission: str):
    async def checker(user: User = Depends(get_current_user)) -> User:
        perms = ROLE_PERMISSIONS.get(user.role, set())
        if permission not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required",
            )
        return user

    return checker


def content_hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:100] or "tenant"
