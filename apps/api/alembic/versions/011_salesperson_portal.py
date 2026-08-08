"""Add sales_person_accounts table + assignment FKs on leads/opportunities."""

revision = "011_salesperson_portal"
down_revision = "010_reseller_portal"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    # portalaccountstatus already exists (009/010) -- create_type=False, uppercase
    # member-name labels, same convention as every other enum column in this codebase.
    op.create_table(
        "sales_person_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("contact_name", sa.String(255), nullable=True),
        sa.Column("commission_rate", sa.Float(), nullable=False, server_default="0"),
        sa.Column("territory", sa.String(255), nullable=True),
        sa.Column("assigned_by", postgresql.UUID(as_uuid=True), nullable=True),
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
        sa.UniqueConstraint("tenant_id", "email", name="uq_sales_person_account_tenant_email"),
    )
    op.create_index("ix_sales_person_accounts_tenant_id", "sales_person_accounts", ["tenant_id"])

    op.add_column(
        "leads", sa.Column("assigned_sales_person_id", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_leads_sales_person", "leads",
        "sales_person_accounts", ["assigned_sales_person_id"], ["id"],
    )

    op.add_column(
        "opportunities", sa.Column("assigned_sales_person_id", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_opportunities_sales_person", "opportunities",
        "sales_person_accounts", ["assigned_sales_person_id"], ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_opportunities_sales_person", "opportunities", type_="foreignkey")
    op.drop_column("opportunities", "assigned_sales_person_id")
    op.drop_constraint("fk_leads_sales_person", "leads", type_="foreignkey")
    op.drop_column("leads", "assigned_sales_person_id")
    op.drop_index("ix_sales_person_accounts_tenant_id", table_name="sales_person_accounts")
    op.drop_table("sales_person_accounts")
