"""Add isolated Bumpa catalog, checkout references, and transfer state."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def _id() -> sa.Column:
    return sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True)


def _merchant_id(*, primary_key: bool = False) -> sa.Column:
    return sa.Column("merchant_id", sa.UUID(), sa.ForeignKey("vendors.id", ondelete="CASCADE"), primary_key=primary_key, nullable=False)


def upgrade() -> None:
    op.add_column("vendors", sa.Column("catalog_provider", sa.String(20), server_default="legacy", nullable=False))
    op.add_column("vendors", sa.Column("slug", sa.String(120)))
    op.add_column("vendors", sa.Column("whatsapp_phone_number_id", sa.String(80)))
    op.add_column("vendors", sa.Column("whatsapp_token_enc", sa.Text()))
    op.add_column("vendors", sa.Column("owner_whatsapp_number", sa.String(30)))
    op.add_column("vendors", sa.Column("payout_bank_name", sa.String(120)))
    op.add_column("vendors", sa.Column("payout_account_name", sa.String(120)))
    op.add_column("vendors", sa.Column("payout_account_number", sa.String(10)))
    op.add_column("vendors", sa.Column("pickup_location_id", sa.String(120)))
    op.add_column("vendors", sa.Column("delivery_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False))
    op.create_unique_constraint("uq_vendors_slug", "vendors", ["slug"])
    op.create_check_constraint("ck_vendors_catalog_provider", "vendors", "catalog_provider IN ('legacy', 'bumpa')")

    op.create_table(
        "bumpa_connections", _id(), _merchant_id(),
        sa.Column("public_key_enc", sa.Text(), nullable=False),
        sa.Column("secret_key_enc", sa.Text()),
        sa.Column("location_id", sa.String(120), nullable=False),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("last_verified_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("merchant_id"),
        sa.CheckConstraint("status IN ('active', 'invalid')", name="ck_bumpa_connections_status"),
    )
    op.create_table(
        "products_cache", _id(), _merchant_id(),
        sa.Column("bumpa_product_id", sa.String(120), nullable=False),
        sa.Column("name", sa.String(255)),
        sa.Column("description", sa.Text()),
        sa.Column("price", sa.Numeric(14, 2)),
        sa.Column("currency", sa.String(8)),
        sa.Column("stock_qty", sa.Integer()),
        sa.Column("image_urls", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("variations", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("raw", postgresql.JSONB(), nullable=False),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("merchant_id", "bumpa_product_id"),
    )
    op.create_index("idx_products_cache_merchant_published", "products_cache", ["merchant_id", "is_published"])
    op.create_table(
        "sync_state", _merchant_id(primary_key=True),
        sa.Column("last_started_at", sa.DateTime(timezone=True)),
        sa.Column("last_succeeded_at", sa.DateTime(timezone=True)),
        sa.Column("last_error", sa.Text()),
        sa.Column("running", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.create_table(
        "checkout_refs", _id(), _merchant_id(),
        sa.Column("bumpa_checkout_id", sa.String(120), nullable=False),
        sa.Column("bumpa_order_id", sa.String(120)),
        sa.Column("payment_reference", sa.String(120)),
        sa.Column("customer_wa_id", sa.String(30)),
        sa.Column("status", sa.String(30), server_default="created", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True)),
        sa.Column("next_poll_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("status IN ('created', 'awaiting_payment', 'paid', 'expired', 'failed')", name="ck_checkout_refs_status"),
    )
    op.create_index("idx_checkout_refs_merchant_status", "checkout_refs", ["merchant_id", "status"])
    op.create_table(
        "pending_transfers", _id(), _merchant_id(),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("bumpa_product_id", sa.String(120), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("customer_wa_id", sa.String(30)),
        sa.Column("status", sa.String(30), server_default="awaiting_proof", nullable=False),
        sa.Column("proof_media_id", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("merchant_id", "reference"),
        sa.CheckConstraint("quantity > 0 AND amount >= 0", name="ck_pending_transfers_amount"),
        sa.CheckConstraint("status IN ('awaiting_proof', 'proof_received', 'confirmed', 'rejected', 'expired')", name="ck_pending_transfers_status"),
    )
    op.create_index("idx_pending_transfers_merchant_status", "pending_transfers", ["merchant_id", "status"])
    op.create_table(
        "conversation_state", _merchant_id(primary_key=True),
        sa.Column("customer_wa_id", sa.String(30), primary_key=True),
        sa.Column("step", sa.String(60), nullable=False),
        sa.Column("payload", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "processed_messages",
        sa.Column("message_id", sa.String(255), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "whatsapp_opt_outs", _merchant_id(primary_key=True),
        sa.Column("customer_wa_id", sa.String(30), primary_key=True),
        sa.Column("opted_out_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("whatsapp_opt_outs")
    op.drop_table("processed_messages")
    op.drop_table("conversation_state")
    op.drop_index("idx_pending_transfers_merchant_status", table_name="pending_transfers")
    op.drop_table("pending_transfers")
    op.drop_index("idx_checkout_refs_merchant_status", table_name="checkout_refs")
    op.drop_table("checkout_refs")
    op.drop_table("sync_state")
    op.drop_index("idx_products_cache_merchant_published", table_name="products_cache")
    op.drop_table("products_cache")
    op.drop_table("bumpa_connections")
    op.drop_constraint("ck_vendors_catalog_provider", "vendors", type_="check")
    op.drop_constraint("uq_vendors_slug", "vendors", type_="unique")
    for column in (
        "delivery_enabled", "pickup_location_id", "payout_account_number",
        "payout_account_name", "payout_bank_name", "owner_whatsapp_number",
        "whatsapp_token_enc", "whatsapp_phone_number_id", "slug", "catalog_provider",
    ):
        op.drop_column("vendors", column)
