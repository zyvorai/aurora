"""Add reseller_accounts table + deal-registration FK on discovered_accounts."""

revision = "010_reseller_portal"
down_revision = "009_external_portals"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    # portalaccountstatus already exists (created by 009) -- reference it with
    # create_type=False so create_table doesn't try to create it a second time. Labels
    # are uppercase member NAMES (SQLAlchemy's Enum(PyEnum) default), matching every
    # other enum column in this codebase -- see 009's fix-up for why this matters.
    op.create_table(
        "reseller_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column("contact_name", sa.String(255), nullable=True),
        sa.Column("business_id", sa.String(255), nullable=True),
        sa.Column("margin_tier", sa.String(50), nullable=False, server_default="standard"),
        sa.Column("authorized_product_ids", postgresql.JSONB(), nullable=True),
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
        sa.UniqueConstraint("tenant_id", "email", name="uq_reseller_account_tenant_email"),
    )
    op.create_index("ix_reseller_accounts_tenant_id", "reseller_accounts", ["tenant_id"])

    op.add_column(
        "discovered_accounts",
        sa.Column("registered_by_reseller_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_discovered_accounts_reseller", "discovered_accounts",
        "reseller_accounts", ["registered_by_reseller_id"], ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_discovered_accounts_reseller", "discovered_accounts", type_="foreignkey")
    op.drop_column("discovered_accounts", "registered_by_reseller_id")
    op.drop_index("ix_reseller_accounts_tenant_id", table_name="reseller_accounts")
    op.drop_table("reseller_accounts")
