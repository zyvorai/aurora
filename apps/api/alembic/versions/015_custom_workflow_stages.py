"""Add custom_workflow_stages table -- tenant-defined stages shown in Full Forge's
sidebar alongside the fixed Foundation/GTM/Revenue/Distribution/Intelligence groups.
Tenant-wide (no product scoping), configured by a tenant admin in Settings."""

revision = "015_custom_workflow_stages"
down_revision = "014_user_oauth_identity"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    op.create_table(
        "custom_workflow_stages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("group_label", sa.String(100), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("icon", sa.String(50), nullable=False),
        sa.Column("tone", sa.String(20), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content_blocks", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_custom_workflow_stages_tenant_id", "custom_workflow_stages", ["tenant_id"])
    op.create_index("ix_custom_workflow_stages_position", "custom_workflow_stages", ["position"])


def downgrade() -> None:
    op.drop_index("ix_custom_workflow_stages_position", table_name="custom_workflow_stages")
    op.drop_index("ix_custom_workflow_stages_tenant_id", table_name="custom_workflow_stages")
    op.drop_table("custom_workflow_stages")
