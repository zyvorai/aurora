"""Add customer_tickets table (Jira-style support tickets for the customer portal)."""

revision = "013_customer_tickets"
down_revision = "012_portal_proof_documents"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    # No-op: 001_initial creates the full current schema via Base.metadata.create_all().
    pass


def downgrade() -> None:
    op.drop_index("ix_customer_tickets_status", table_name="customer_tickets")
    op.drop_index("ix_customer_tickets_customer_account_id", table_name="customer_tickets")
    op.drop_index("ix_customer_tickets_tenant_id", table_name="customer_tickets")
    op.drop_table("customer_tickets")
    op.execute("DROP TYPE IF EXISTS ticketpriority")
    op.execute("DROP TYPE IF EXISTS ticketstatus")
