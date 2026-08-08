"""Add retry_count/next_retry_at to channel_posts for the publish retry queue."""

revision = "008_channel_post_retry"
down_revision = "007_api_keys"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column("channel_posts", sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("channel_posts", sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("channel_posts", "next_retry_at")
    op.drop_column("channel_posts", "retry_count")
