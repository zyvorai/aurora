"""Add license_state singleton for the keyless 30-day trial clock."""

revision = "016_license_state"
down_revision = "015_custom_workflow_stages"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    # No-op: 001_initial creates the full current schema via Base.metadata.create_all().
    pass


def downgrade() -> None:
    op.drop_table("license_state")
