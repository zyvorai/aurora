"""Source hub: extended source types and metadata columns."""

revision = "006_source_hub"
down_revision = "005_wave4_success"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    op.execute("ALTER TYPE sourcetype ADD VALUE IF NOT EXISTS 'file'")
    op.execute("ALTER TYPE sourcetype ADD VALUE IF NOT EXISTS 'audio'")
    op.execute("ALTER TYPE sourcetype ADD VALUE IF NOT EXISTS 'spreadsheet'")
    op.execute("ALTER TYPE sourcetype ADD VALUE IF NOT EXISTS 'database'")

    op.alter_column("sources", "url", existing_type=sa.String(2048), nullable=True)
    op.add_column("sources", sa.Column("display_name", sa.String(512), nullable=True))
    op.add_column("sources", sa.Column("storage_key", sa.String(1024), nullable=True))
    op.add_column("sources", sa.Column("mime_type", sa.String(255), nullable=True))
    op.add_column("sources", sa.Column("file_size_bytes", sa.Integer(), nullable=True))
    op.add_column(
        "sources",
        sa.Column("credential_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_sources_credential_id",
        "sources",
        "source_credentials",
        ["credential_id"],
        ["id"],
    )
    op.create_index("ix_sources_credential_id", "sources", ["credential_id"])


def downgrade() -> None:
    op.drop_index("ix_sources_credential_id", table_name="sources")
    op.drop_constraint("fk_sources_credential_id", "sources", type_="foreignkey")
    op.drop_column("sources", "credential_id")
    op.drop_column("sources", "file_size_bytes")
    op.drop_column("sources", "mime_type")
    op.drop_column("sources", "storage_key")
    op.drop_column("sources", "display_name")
    op.alter_column("sources", "url", existing_type=sa.String(2048), nullable=False)
