"""Seed a demo payment account only for vendors without one."""

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

DEMO_ACCOUNT = "0123456789"


def upgrade():
    op.execute(
        "UPDATE vendors SET bank_account = '0123456789' "
        "WHERE bank_account IS NULL OR bank_account = ''"
    )


def downgrade():
    op.execute(
        "UPDATE vendors SET bank_account = NULL "
        "WHERE bank_account = '0123456789'"
    )
