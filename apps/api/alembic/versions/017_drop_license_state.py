"""Drop unused license_state table (keyless trial removed).

Revision ID: 017_drop_license_state
Revises: 016_license_state
Create Date: 2026-09-13
"""

from alembic import op

revision = "017_drop_license_state"
down_revision = "016_license_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS license_state")


def downgrade() -> None:
    # Historical keyless-trial table; not recreated — this build has no license gate.
    pass
