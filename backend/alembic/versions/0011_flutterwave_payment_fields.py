"""Add provider-neutral payment fields for Flutterwave and legacy Paystack orders."""

import sqlalchemy as sa

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("vendors", sa.Column("flutterwave_bank_code", sa.String(20), nullable=True))
    op.add_column("vendors", sa.Column("flutterwave_subaccount_id", sa.String(80), nullable=True))
    op.add_column("orders", sa.Column("payment_provider", sa.String(30), nullable=True))
    op.add_column("orders", sa.Column("payment_reference", sa.String(120), nullable=True))
    op.add_column("orders", sa.Column("payment_transaction_id", sa.String(120), nullable=True))
    op.execute("UPDATE orders SET payment_provider = 'paystack', payment_reference = paystack_ref WHERE paystack_ref IS NOT NULL")
    op.execute("UPDATE orders SET payment_provider = 'flutterwave' WHERE payment_provider IS NULL")
    op.alter_column("orders", "payment_provider", nullable=False, server_default="flutterwave")


def downgrade():
    op.drop_column("vendors", "flutterwave_subaccount_id")
    op.drop_column("vendors", "flutterwave_bank_code")
    op.drop_column("orders", "payment_transaction_id")
    op.drop_column("orders", "payment_reference")
    op.drop_column("orders", "payment_provider")
