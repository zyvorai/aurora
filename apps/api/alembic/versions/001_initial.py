"""Initial schema migration."""

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    # Creates the full current schema from the SQLAlchemy models in one shot
    # (same approach apps/api/scripts/init_db.py uses for local dev) rather than
    # hand-writing every table. Migrations 002-016 are no-ops for upgrade() as a
    # result -- the schema they'd add already exists in the current models, and
    # this is a first-ever production migration chain with no real database that
    # only ever had 001 applied, so there's no incremental state to preserve.
    from gtm_api.models import Base

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    pass
