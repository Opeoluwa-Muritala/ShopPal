"""Add audited vendor payment confirmation fields."""

import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("orders", sa.Column("payment_confirmed_by", sa.UUID(), sa.ForeignKey("accounts.id")))
    op.add_column("orders", sa.Column("payment_confirmed_at", sa.DateTime(timezone=True)))
    op.add_column("orders", sa.Column("payment_confirmation_source", sa.String(30)))


def downgrade():
    op.drop_column("orders", "payment_confirmation_source")
    op.drop_column("orders", "payment_confirmed_at")
    op.drop_column("orders", "payment_confirmed_by")
