"""Make users.hashed_password nullable and add oauth_provider/oauth_subject for
consumer social login (Google/GitHub) -- distinct from the tenant-wide enterprise
SSO in gtm_api/services/sso.py, which never sets these columns."""

revision = "014_user_oauth_identity"
down_revision = "013_customer_tickets"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.alter_column("users", "hashed_password", existing_type=sa.String(255), nullable=True)
    op.add_column("users", sa.Column("oauth_provider", sa.String(50), nullable=True))
    op.add_column("users", sa.Column("oauth_subject", sa.String(255), nullable=True))
    op.create_index(
        "uq_user_oauth_identity", "users", ["oauth_provider", "oauth_subject"],
        unique=True, postgresql_where=sa.text("oauth_provider IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_user_oauth_identity", table_name="users")
    op.drop_column("users", "oauth_subject")
    op.drop_column("users", "oauth_provider")
    op.alter_column("users", "hashed_password", existing_type=sa.String(255), nullable=False)
