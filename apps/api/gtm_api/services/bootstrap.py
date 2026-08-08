"""One-time bootstrap seeding: a default admin account, matching the customer-install
convention used elsewhere in this product family (login admin / Admin@321). This app is
email-identified (unique per tenant+email, not a bare username), so the seeded login is
the email below, not a literal "admin" username.

Idempotent by design: only creates the account if no user with DEFAULT_ADMIN_EMAIL
exists yet, so it never resets a password an operator has since changed.
"""

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.auth import hash_password
from gtm_api.models import PlanTier, Tenant, User

logger = structlog.get_logger()

DEFAULT_ADMIN_EMAIL = "marketing@zyvor.dev"
DEFAULT_ADMIN_PASSWORD = "Admin@321"
DEFAULT_TENANT_SLUG = "admin"
DEFAULT_TENANT_NAME = "Admin"


async def seed_default_admin(db: AsyncSession) -> bool:
    """Returns True if the account was created, False if it already existed."""
    existing = await db.execute(select(User).where(User.email == DEFAULT_ADMIN_EMAIL))
    if existing.scalar_one_or_none() is not None:
        return False

    result = await db.execute(select(Tenant).where(Tenant.slug == DEFAULT_TENANT_SLUG))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        tenant = Tenant(name=DEFAULT_TENANT_NAME, slug=DEFAULT_TENANT_SLUG, plan=PlanTier.ENTERPRISE)
        db.add(tenant)
        await db.flush()

    user = User(
        tenant_id=tenant.id,
        email=DEFAULT_ADMIN_EMAIL,
        hashed_password=hash_password(DEFAULT_ADMIN_PASSWORD),
        full_name="Administrator",
        role="admin",
    )
    db.add(user)
    await db.commit()
    logger.warning(
        "seeded_default_admin",
        email=DEFAULT_ADMIN_EMAIL,
        note="Default credentials seeded — change this password immediately in any real deployment.",
    )
    return True
