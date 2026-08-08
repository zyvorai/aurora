"""Wave 0 tables: dashboard_snapshots, workflow_runs."""

revision = "002_wave0_lean"
down_revision = "001_initial"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    # No-op: 001_initial now creates the full current schema (including this
    # migration's tables) via Base.metadata.create_all(). Kept for history and
    # because downgrade() below is still valid (the tables exist regardless of
    # which migration originally "created" them).
    pass


def downgrade() -> None:
    op.drop_table("workflow_runs")
    op.drop_table("dashboard_snapshots")
