"""Add proof_document_key to reseller_accounts and sales_person_accounts."""

revision = "012_portal_proof_documents"
down_revision = "011_salesperson_portal"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column("reseller_accounts", sa.Column("proof_document_key", sa.String(1024), nullable=True))
    op.add_column("sales_person_accounts", sa.Column("proof_document_key", sa.String(1024), nullable=True))


def downgrade() -> None:
    op.drop_column("sales_person_accounts", "proof_document_key")
    op.drop_column("reseller_accounts", "proof_document_key")
