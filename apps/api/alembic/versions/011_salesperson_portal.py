"""Add sales_person_accounts table + assignment FKs on leads/opportunities."""

revision = "011_salesperson_portal"
down_revision = "010_reseller_portal"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    # No-op: 001_initial creates the full current schema via Base.metadata.create_all().
    pass


def downgrade() -> None:
    op.drop_constraint("fk_opportunities_sales_person", "opportunities", type_="foreignkey")
    op.drop_column("opportunities", "assigned_sales_person_id")
    op.drop_constraint("fk_leads_sales_person", "leads", type_="foreignkey")
    op.drop_column("leads", "assigned_sales_person_id")
    op.drop_index("ix_sales_person_accounts_tenant_id", table_name="sales_person_accounts")
    op.drop_table("sales_person_accounts")
