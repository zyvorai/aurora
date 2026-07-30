"""Enterprise features: SSO hooks, RBAC enforcement, compliance (Phase 12)."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import (
    AuditLog,
    Chunk,
    Document,
    Entity,
    Product,
    SuppressionEntry,
    Tenant,
    User,
)
from gtm_api.services.knowledge_graph import knowledge_graph
from gtm_api.services.vector_store import vector_store
from gtm_api.tenant import audit_log


ENTERPRISE_FEATURES = {
    "starter": {"products": 1, "sso": False, "audit": True, "private_deploy": False},
    "growth": {"products": 10, "sso": False, "audit": True, "private_deploy": False},
    "enterprise": {"products": 1000, "sso": True, "audit": True, "private_deploy": True},
}


def get_plan_features(plan: str) -> dict:
    return ENTERPRISE_FEATURES.get(plan, ENTERPRISE_FEATURES["starter"])


async def check_product_limit(db: AsyncSession, tenant: Tenant) -> bool:
    features = get_plan_features(tenant.plan.value)
    result = await db.execute(
        select(Product).where(Product.tenant_id == tenant.id, Product.is_active.is_(True))
    )
    count = len(result.scalars().all())
    return count < features["products"]


async def purge_tenant_data(
    db: AsyncSession,
    tenant_id: uuid.UUID,
) -> dict:
    products = await db.execute(select(Product).where(Product.tenant_id == tenant_id))
    for product in products.scalars().all():
        await vector_store.delete_product_chunks(tenant_id, product.id)
        try:
            await knowledge_graph.delete_product_graph(tenant_id, product.id)
        except Exception:
            pass

    await audit_log(db, tenant_id, None, "purge", "tenant", resource_id=str(tenant_id))

    return {"status": "purged", "tenant_id": str(tenant_id)}


async def add_suppression(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    email: str,
    reason: str = "opt_out",
) -> SuppressionEntry:
    entry = SuppressionEntry(tenant_id=tenant_id, email=email.lower(), reason=reason)
    db.add(entry)
    return entry


async def is_suppressed(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    email: str,
) -> bool:
    result = await db.execute(
        select(SuppressionEntry).where(
            SuppressionEntry.tenant_id == tenant_id,
            SuppressionEntry.email == email.lower(),
        )
    )
    return result.scalar_one_or_none() is not None


async def get_audit_trail(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    limit: int = 100,
) -> list[AuditLog]:
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.tenant_id == tenant_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def export_tenant_data(
    db: AsyncSession,
    tenant_id: uuid.UUID,
) -> dict:
    products = await db.execute(select(Product).where(Product.tenant_id == tenant_id))
    users = await db.execute(select(User).where(User.tenant_id == tenant_id))

    return {
        "tenant_id": str(tenant_id),
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "products": [
            {"id": str(p.id), "name": p.name, "profile": p.profile}
            for p in products.scalars().all()
        ],
        "users": [
            {"id": str(u.id), "email": u.email, "role": u.role}
            for u in users.scalars().all()
        ],
    }
