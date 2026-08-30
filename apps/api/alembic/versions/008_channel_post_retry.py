"""Add retry_count/next_retry_at to channel_posts for the publish retry queue."""

revision = "008_channel_post_retry"
down_revision = "007_api_keys"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    # No-op: 001_initial creates the full current schema via Base.metadata.create_all().
    pass


def downgrade() -> None:
    op.drop_column("channel_posts", "next_retry_at")
    op.drop_column("channel_posts", "retry_count")
