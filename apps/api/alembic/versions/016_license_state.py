"""Add license_state singleton for the keyless 30-day trial clock."""

revision = "016_license_state"
down_revision = "015_custom_workflow_stages"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.create_table(
        "license_state",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("license_state")
