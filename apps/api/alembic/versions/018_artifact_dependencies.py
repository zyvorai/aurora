"""Track source versions behind artifacts and flag stale ones.

Revision ID: 018_artifact_dependencies
Revises: 017_drop_license_state
Create Date: 2026-10-20
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "018_artifact_dependencies"
down_revision = "017_drop_license_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("artifacts", sa.Column("stale_reason", sa.String(50), nullable=True))
    op.add_column("artifacts", sa.Column("stale_since", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "artifact_dependencies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("artifact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("artifacts.id"), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_url", sa.String(2048), nullable=True),
        sa.Column("document_title", sa.String(512), nullable=False, server_default=""),
        sa.Column("content_hash_at_use", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_artifact_dependencies_tenant_id", "artifact_dependencies", ["tenant_id"])
    op.create_index("ix_artifact_dependencies_artifact_id", "artifact_dependencies", ["artifact_id"])


def downgrade() -> None:
    op.drop_table("artifact_dependencies")
    op.drop_column("artifacts", "stale_since")
    op.drop_column("artifacts", "stale_reason")
