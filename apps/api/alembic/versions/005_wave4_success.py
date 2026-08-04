"""Wave 4 tables: account_health."""

revision = "005_wave4_success"
down_revision = "004_wave3_crm"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    op.create_table(
        "account_health",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column(
            "opportunity_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("opportunities.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("health_score", sa.Float(), server_default="50"),
        sa.Column("status", sa.String(50), server_default="healthy"),
        sa.Column("metrics", postgresql.JSONB(), server_default="{}"),
        sa.Column("playbook", postgresql.JSONB(), server_default="{}"),
        sa.Column("cs_brief", postgresql.JSONB(), server_default="{}"),
        sa.Column("last_cs_brief_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_account_health_tenant_id", "account_health", ["tenant_id"])
    op.create_index("ix_account_health_product_id", "account_health", ["product_id"])
    op.create_index("ix_account_health_opportunity_id", "account_health", ["opportunity_id"])


def downgrade() -> None:
    op.drop_table("account_health")
