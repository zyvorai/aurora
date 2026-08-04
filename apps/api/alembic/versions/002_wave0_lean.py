"""Wave 0 tables: dashboard_snapshots, workflow_runs."""

revision = "002_wave0_lean"
down_revision = "001_initial"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    op.create_table(
        "dashboard_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("snapshot_type", sa.String(50), server_default="executive_brief"),
        sa.Column("data", postgresql.JSONB(), server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("tenant_id", "product_id", "snapshot_type", name="uq_dashboard_snapshot"),
    )
    op.create_index("ix_dashboard_snapshots_tenant_id", "dashboard_snapshots", ["tenant_id"])
    op.create_index("ix_dashboard_snapshots_product_id", "dashboard_snapshots", ["product_id"])

    op.create_table(
        "workflow_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("workflow_name", sa.String(100), nullable=False),
        sa.Column("status", sa.String(50), server_default="queued"),
        sa.Column("input_data", postgresql.JSONB(), server_default="{}"),
        sa.Column("output_data", postgresql.JSONB(), server_default="{}"),
        sa.Column("steps", postgresql.JSONB(), server_default="[]"),
        sa.Column("error_message", sa.Text()),
        sa.Column("created_by", postgresql.UUID(as_uuid=True)),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_workflow_runs_tenant_id", "workflow_runs", ["tenant_id"])
    op.create_index("ix_workflow_runs_product_id", "workflow_runs", ["product_id"])


def downgrade() -> None:
    op.drop_table("workflow_runs")
    op.drop_table("dashboard_snapshots")
