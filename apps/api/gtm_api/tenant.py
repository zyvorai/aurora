"""Tenant context and isolation utilities."""

import uuid
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import Product, Tenant, UsageMeter, User


@dataclass
class TenantContext:
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    role: str
    plan: str


async def get_tenant_context(user: User, db: AsyncSession) -> TenantContext:
    result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant or not tenant.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant inactive")
    return TenantContext(
        tenant_id=tenant.id,
        user_id=user.id,
        role=user.role,
        plan=tenant.plan.value,
    )


async def get_product_for_tenant(
    db: AsyncSession, product_id: uuid.UUID, tenant_id: uuid.UUID
) -> Product:
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.tenant_id == tenant_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


async def check_quota(
    db: AsyncSession, tenant_id: uuid.UUID, tokens: int = 0, pages: int = 0
) -> None:
    from datetime import datetime, timezone

    from gtm_api.config import get_settings

    settings = get_settings()
    period = datetime.now(timezone.utc).strftime("%Y-%m")

    result = await db.execute(
        select(UsageMeter).where(UsageMeter.tenant_id == tenant_id, UsageMeter.period == period)
    )
    meter = result.scalar_one_or_none()
    if meter is None:
        return

    tokens_used = meter.tokens_used or 0
    pages_crawled = meter.pages_crawled or 0
    if tokens_used + tokens > settings.quota_tokens:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Token quota exceeded for this billing period",
        )
    if pages_crawled + pages > settings.quota_pages:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Page crawl quota exceeded for this billing period",
        )


async def record_usage(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    tokens: int = 0,
    pages: int = 0,
    agent_runs: int = 0,
) -> None:
    from datetime import datetime, timezone

    period = datetime.now(timezone.utc).strftime("%Y-%m")
    result = await db.execute(
        select(UsageMeter).where(UsageMeter.tenant_id == tenant_id, UsageMeter.period == period)
    )
    meter = result.scalar_one_or_none()
    if meter is None:
        meter = UsageMeter(
            tenant_id=tenant_id,
            period=period,
            tokens_used=tokens,
            pages_crawled=pages,
            agent_runs=agent_runs,
        )
        db.add(meter)
        return

    meter.tokens_used = (meter.tokens_used or 0) + tokens
    meter.pages_crawled = (meter.pages_crawled or 0) + pages
    meter.agent_runs = (meter.agent_runs or 0) + agent_runs


async def audit_log(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: Optional[uuid.UUID],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
) -> None:
    from gtm_api.models import AuditLog

    log = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
    )
    db.add(log)
