"""Wave 3 tables: opportunities, opportunity_activities."""

revision = "004_wave3_crm"
down_revision = "003_wave2_pipeline"
branch_labels = None
depends_on = None


from alembic import op


def upgrade() -> None:
    # No-op: 001_initial now creates the full current schema (including this
    # migration's tables) via Base.metadata.create_all().
    pass


def downgrade() -> None:
    op.drop_table("opportunity_activities")
    op.drop_table("opportunities")
