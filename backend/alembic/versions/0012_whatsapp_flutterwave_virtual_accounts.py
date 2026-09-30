"""Add WhatsApp customers, dynamic virtual-account payment state, and webhook events."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "customers",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("wa_number", sa.String(30), nullable=False, unique=True),
        sa.Column("fw_customer_id", sa.String(120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_table(
        "webhook_events",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("fw_transaction_id", sa.String(120), nullable=False, unique=True),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    for name, column in (
        ("wa_number", sa.String(30)),
        ("currency", sa.String(3)),
        ("tx_ref", sa.String(42)),
        ("fw_reference", sa.String(120)),
        ("account_number", sa.String(20)),
        ("bank_name", sa.String(120)),
        ("expires_at", sa.DateTime(timezone=True)),
        ("paid_at", sa.DateTime(timezone=True)),
        ("fw_transaction_id", sa.String(120)),
    ):
        op.add_column("orders", sa.Column(column.name, column, nullable=True))
    op.alter_column("orders", "currency", server_default="NGN")
    op.create_index("idx_orders_expires_at", "orders", ["expires_at"])
    op.create_index("idx_orders_wa_number", "orders", ["wa_number"])
    op.create_unique_constraint("uq_orders_tx_ref", "orders", ["tx_ref"])
    op.create_unique_constraint("uq_orders_fw_transaction_id", "orders", ["fw_transaction_id"])


def downgrade():
    op.drop_constraint("uq_orders_fw_transaction_id", "orders", type_="unique")
    op.drop_constraint("uq_orders_tx_ref", "orders", type_="unique")
    op.drop_index("idx_orders_wa_number", table_name="orders")
    op.drop_index("idx_orders_expires_at", table_name="orders")
    for name in ("fw_transaction_id", "paid_at", "expires_at", "bank_name", "account_number", "fw_reference", "tx_ref", "currency", "wa_number"):
        op.drop_column("orders", name)
    op.drop_table("webhook_events")
    op.drop_table("customers")
