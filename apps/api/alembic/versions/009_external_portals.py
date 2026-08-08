"""Add customer_accounts table for the external customer portal."""

revision = "009_external_portals"
down_revision = "008_channel_post_retry"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    # Create the enum type explicitly first (checkfirst=True), then reference it in the
    # column below with create_type=False -- otherwise create_table()'s own dispatch also
    # tries to create the type (postgresql.ENUM defaults to create_type=True), and the
    # second CREATE TYPE fails with DuplicateObjectError since it doesn't check first.
    portal_account_status = postgresql.ENUM(
        "PENDING", "APPROVED", "REJECTED", "SUSPENDED",
        name="portalaccountstatus",
    )
    portal_account_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "customer_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column(
            "discovered_account_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("discovered_accounts.id"), nullable=True,
        ),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column("contact_name", sa.String(255), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(
                "PENDING", "APPROVED", "REJECTED", "SUSPENDED",
                name="portalaccountstatus", create_type=False,
            ),
            nullable=False, server_default="PENDING",
        ),
        sa.Column("rejected_reason", sa.Text(), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("tenant_id", "email", name="uq_customer_account_tenant_email"),
    )
    op.create_index("ix_customer_accounts_tenant_id", "customer_accounts", ["tenant_id"])
    op.create_index("ix_customer_accounts_product_id", "customer_accounts", ["product_id"])


def downgrade() -> None:
    op.drop_index("ix_customer_accounts_product_id", table_name="customer_accounts")
    op.drop_index("ix_customer_accounts_tenant_id", table_name="customer_accounts")
    op.drop_table("customer_accounts")
    postgresql.ENUM(name="portalaccountstatus").drop(op.get_bind(), checkfirst=True)
