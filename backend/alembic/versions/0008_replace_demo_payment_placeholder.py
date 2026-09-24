"""Replace the default demo payment placeholder with an account number."""

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "UPDATE vendors SET bank_account = '0123456789' "
        "WHERE bank_account = 'Demo store - cash on delivery'"
    )


def downgrade():
    op.execute(
        "UPDATE vendors SET bank_account = 'Demo store - cash on delivery' "
        "WHERE bank_account = '0123456789'"
    )
