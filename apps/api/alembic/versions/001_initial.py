"""Initial schema migration."""

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    # Tables are created via SQLAlchemy models; this migration serves as version tracking.
    # Run: python -c "from gtm_api.models import Base; from gtm_api.database import engine; ..."
    pass


def downgrade() -> None:
    pass
