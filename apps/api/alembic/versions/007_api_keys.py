"""Add api_keys table for public API-key authentication."""

revision = "007_api_keys"
down_revision = "006_source_hub"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    # No-op: 001_initial creates the full current schema via Base.metadata.create_all().
    pass


def downgrade() -> None:
    op.drop_index("ix_api_keys_key_hash", table_name="api_keys")
    op.drop_index("ix_api_keys_tenant_id", table_name="api_keys")
    op.drop_table("api_keys")
