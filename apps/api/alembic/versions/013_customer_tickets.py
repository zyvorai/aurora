"""Add customer_tickets table (Jira-style support tickets for the customer portal)."""

revision = "013_customer_tickets"
down_revision = "012_portal_proof_documents"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    ticket_status = postgresql.ENUM(
        "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", name="ticketstatus",
    )
    ticket_status.create(op.get_bind(), checkfirst=True)
    ticket_priority = postgresql.ENUM(
        "LOW", "MEDIUM", "HIGH", "URGENT", name="ticketpriority",
    )
    ticket_priority.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "customer_tickets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column(
            "customer_account_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("customer_accounts.id"), nullable=False,
        ),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", name="ticketstatus", create_type=False),
            nullable=False, server_default="OPEN",
        ),
        sa.Column(
            "priority",
            postgresql.ENUM("LOW", "MEDIUM", "HIGH", "URGENT", name="ticketpriority", create_type=False),
            nullable=False, server_default="MEDIUM",
        ),
        sa.Column("resolved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_customer_tickets_tenant_id", "customer_tickets", ["tenant_id"])
    op.create_index("ix_customer_tickets_customer_account_id", "customer_tickets", ["customer_account_id"])
    op.create_index("ix_customer_tickets_status", "customer_tickets", ["status"])


def downgrade() -> None:
    op.drop_index("ix_customer_tickets_status", table_name="customer_tickets")
    op.drop_index("ix_customer_tickets_customer_account_id", table_name="customer_tickets")
    op.drop_index("ix_customer_tickets_tenant_id", table_name="customer_tickets")
    op.drop_table("customer_tickets")
    op.execute("DROP TYPE IF EXISTS ticketpriority")
    op.execute("DROP TYPE IF EXISTS ticketstatus")
