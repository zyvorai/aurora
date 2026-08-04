"""Wave 3 tables: opportunities, opportunity_activities."""

revision = "004_wave3_crm"
down_revision = "003_wave2_pipeline"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    op.create_table(
        "opportunities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("company", sa.String(255)),
        sa.Column("stage", sa.String(50), server_default="discovery"),
        sa.Column("amount", sa.Float()),
        sa.Column("probability", sa.Float(), server_default="0.1"),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True)),
        sa.Column("proposal_artifact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("artifacts.id")),
        sa.Column("architect_artifact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("artifacts.id")),
        sa.Column("metadata", postgresql.JSONB(), server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_opportunities_product_id", "opportunities", ["product_id"])
    op.create_index("ix_opportunities_tenant_id", "opportunities", ["tenant_id"])
    op.create_index("ix_opportunities_lead_id", "opportunities", ["lead_id"])
    op.create_index(
        "ix_opportunities_tenant_product_stage",
        "opportunities",
        ["tenant_id", "product_id", "stage"],
    )

    op.create_table(
        "opportunity_activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "opportunity_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("opportunities.id"),
            nullable=False,
        ),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("activity_type", sa.String(50), server_default="note"),
        sa.Column("subject", sa.String(255), server_default=""),
        sa.Column("body", sa.Text()),
        sa.Column("created_by", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_opportunity_activities_opportunity_id", "opportunity_activities", ["opportunity_id"])
    op.create_index("ix_opportunity_activities_tenant_id", "opportunity_activities", ["tenant_id"])


def downgrade() -> None:
    op.drop_table("opportunity_activities")
    op.drop_table("opportunities")
