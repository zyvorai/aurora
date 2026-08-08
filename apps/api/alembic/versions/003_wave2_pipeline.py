"""Wave 2 tables: discovered_accounts, lead_scores."""

revision = "003_wave2_pipeline"
down_revision = "002_wave0_lean"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    # No-op: 001_initial now creates the full current schema (including this
    # migration's tables and enum values) via Base.metadata.create_all().
    pass


def downgrade() -> None:
    op.drop_table("lead_scores")
    op.drop_table("discovered_accounts")
