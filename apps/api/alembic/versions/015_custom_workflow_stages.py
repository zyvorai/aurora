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
    # No-op: 001_initial creates the full current schema via Base.metadata.create_all().
    pass


def downgrade() -> None:
    op.drop_index("ix_custom_workflow_stages_position", table_name="custom_workflow_stages")
    op.drop_index("ix_custom_workflow_stages_tenant_id", table_name="custom_workflow_stages")
    op.drop_table("custom_workflow_stages")
