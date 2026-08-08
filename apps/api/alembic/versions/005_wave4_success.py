"""Wave 4 tables: account_health."""

revision = "005_wave4_success"
down_revision = "004_wave3_crm"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    # No-op: 001_initial now creates the full current schema (including this
    # migration's table) via Base.metadata.create_all().
    pass


def downgrade() -> None:
    op.drop_table("account_health")
