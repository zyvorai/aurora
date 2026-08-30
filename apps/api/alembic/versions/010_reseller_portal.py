"""Add reseller_accounts table + deal-registration FK on discovered_accounts."""

revision = "010_reseller_portal"
down_revision = "009_external_portals"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    # No-op: 001_initial creates the full current schema via Base.metadata.create_all().
    pass


def downgrade() -> None:
    op.drop_constraint("fk_discovered_accounts_reseller", "discovered_accounts", type_="foreignkey")
    op.drop_column("discovered_accounts", "registered_by_reseller_id")
    op.drop_index("ix_reseller_accounts_tenant_id", table_name="reseller_accounts")
    op.drop_table("reseller_accounts")
