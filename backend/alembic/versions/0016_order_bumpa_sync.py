"""Add idempotent post-payment Bumpa order synchronization state."""

import sqlalchemy as sa

from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("bumpa_product_id", sa.String(120)))
    op.add_column("orders", sa.Column("bumpa_order_id", sa.String(120)))
    op.add_column(
        "orders",
        sa.Column("bumpa_sync_status", sa.String(20), server_default="pending", nullable=False),
    )
    op.add_column("orders", sa.Column("bumpa_sync_error", sa.Text()))
    op.add_column("orders", sa.Column("bumpa_sync_claimed_at", sa.DateTime(timezone=True)))
    op.create_index("idx_orders_bumpa_sync", "orders", ["payment_status", "bumpa_sync_status"])
    op.create_check_constraint(
        "ck_orders_bumpa_sync_status",
        "orders",
        "bumpa_sync_status IN ('pending', 'synced', 'failed')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_orders_bumpa_sync_status", "orders", type_="check")
    op.drop_index("idx_orders_bumpa_sync", table_name="orders")
    op.drop_column("orders", "bumpa_sync_claimed_at")
    op.drop_column("orders", "bumpa_sync_error")
    op.drop_column("orders", "bumpa_sync_status")
    op.drop_column("orders", "bumpa_order_id")
    op.drop_column("products", "bumpa_product_id")
