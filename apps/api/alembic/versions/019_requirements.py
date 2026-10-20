"""Customer requirements and evidence-backed proofs for opportunities.

Revision ID: 019_requirements
Revises: 018_artifact_dependencies
Create Date: 2026-10-20
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "019_requirements"
down_revision = "018_artifact_dependencies"
branch_labels = None
depends_on = None

UUID = postgresql.UUID(as_uuid=True)
JSONB = postgresql.JSONB


def upgrade() -> None:
    op.create_table(
        "requirements",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("tenant_id", UUID, sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("product_id", UUID, sa.ForeignKey("products.id"), nullable=False),
        sa.Column("opportunity_id", UUID, sa.ForeignKey("opportunities.id"), nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("position", sa.Integer, server_default="0"),
        sa.Column("source", sa.String(255), server_default="pasted"),
        sa.Column("owner_user_id", UUID, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    for col in ("tenant_id", "product_id", "opportunity_id"):
        op.create_index(f"ix_requirements_{col}", "requirements", [col])

    op.create_table(
        "requirement_proofs",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("tenant_id", UUID, sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("requirement_id", UUID, sa.ForeignKey("requirements.id"), nullable=False),
        sa.Column("verdict", sa.String(20), nullable=False, server_default="unknown"),
        sa.Column("answer", sa.Text, server_default=""),
        sa.Column("conditions", sa.Text, nullable=True),
        sa.Column("validation_test", sa.Text, nullable=True),
        sa.Column("citations", JSONB, nullable=True),
        sa.Column("claims", JSONB, nullable=True),
        sa.Column("source_versions", JSONB, nullable=True),
        sa.Column("confidence", sa.Float, server_default="0"),
        sa.Column("review_status", sa.String(20), server_default="pending"),
        sa.Column("reviewer_id", UUID, nullable=True),
        sa.Column("review_comment", sa.Text, nullable=True),
        sa.Column("stale_reason", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_requirement_proofs_tenant_id", "requirement_proofs", ["tenant_id"])
    op.create_index("ix_requirement_proofs_requirement_id", "requirement_proofs", ["requirement_id"])


def downgrade() -> None:
    op.drop_table("requirement_proofs")
    op.drop_table("requirements")
