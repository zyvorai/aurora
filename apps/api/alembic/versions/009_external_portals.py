"""Add customer_accounts table for the external customer portal."""

revision = "009_external_portals"
down_revision = "008_channel_post_retry"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    # No-op: 001_initial creates the full current schema via Base.metadata.create_all().
    pass


def downgrade() -> None:
    op.drop_index("ix_customer_accounts_product_id", table_name="customer_accounts")
    op.drop_index("ix_customer_accounts_tenant_id", table_name="customer_accounts")
    op.drop_table("customer_accounts")
    postgresql.ENUM(name="portalaccountstatus").drop(op.get_bind(), checkfirst=True)
