"""Wave 2 tables: discovered_accounts, lead_scores."""

revision = "003_wave2_pipeline"
down_revision = "002_wave0_lean"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    op.execute("ALTER TYPE artifacttype ADD VALUE IF NOT EXISTS 'MARKET_RESEARCH'")

    op.create_table(
        "discovered_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("domain", sa.String(255)),
        sa.Column("industry", sa.String(100)),
        sa.Column("company_size", sa.String(50)),
        sa.Column("geo", sa.String(100)),
        sa.Column("personas", postgresql.JSONB(), server_default="[]"),
        sa.Column("source", sa.String(50), server_default="rules"),
        sa.Column("status", sa.String(50), server_default="new"),
        sa.Column("metadata", postgresql.JSONB(), server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_discovered_accounts_product_id", "discovered_accounts", ["product_id"])
    op.create_index("ix_discovered_accounts_tenant_id", "discovered_accounts", ["tenant_id"])

    op.create_table(
        "lead_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("discovered_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("discovered_accounts.id")),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id")),
        sa.Column("score", sa.Float(), server_default="0"),
        sa.Column("tier", sa.String(1), server_default="C"),
        sa.Column("factors", postgresql.JSONB(), server_default="{}"),
        sa.Column("explanation", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_lead_scores_product_id", "lead_scores", ["product_id"])


def downgrade() -> None:
    op.drop_table("lead_scores")
    op.drop_table("discovered_accounts")
