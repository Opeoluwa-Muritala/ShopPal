"""Persist encrypted Bumpa guest cart sessions."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bumpa_guest_carts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("merchant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_wa_id", sa.String(length=30), nullable=False),
        sa.Column("bumpa_cart_id", sa.String(length=120), nullable=False),
        sa.Column("cart_token_enc", sa.Text(), nullable=False),
        sa.Column("items", postgresql.JSONB(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["merchant_id"], ["vendors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("merchant_id", "customer_wa_id"),
    )


def downgrade() -> None:
    op.drop_table("bumpa_guest_carts")
