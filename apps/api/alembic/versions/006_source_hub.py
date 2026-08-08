"""Source hub: extended source types and metadata columns."""

revision = "006_source_hub"
down_revision = "005_wave4_success"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    # No-op: 001_initial now creates the full current schema (including these
    # columns/enum values on `sources`) via Base.metadata.create_all().
    pass


def downgrade() -> None:
    op.drop_index("ix_sources_credential_id", table_name="sources")
    op.drop_constraint("fk_sources_credential_id", "sources", type_="foreignkey")
    op.drop_column("sources", "credential_id")
    op.drop_column("sources", "file_size_bytes")
    op.drop_column("sources", "mime_type")
    op.drop_column("sources", "storage_key")
    op.drop_column("sources", "display_name")
    op.alter_column("sources", "url", existing_type=sa.String(2048), nullable=False)
