"""persist Meta WhatsApp image and voice media"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "whatsapp_media",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("order_id", sa.UUID(), nullable=True),
        sa.Column("wa_media_id", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=False),
        sa.Column("content", postgresql.BYTEA(), nullable=True),
        sa.Column("message_type", sa.String(length=10), nullable=False),
        sa.Column("transcript", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("wa_media_id"),
        sa.CheckConstraint("message_type IN ('image', 'voice')", name="ck_whatsapp_media_message_type"),
    )
    op.create_index("idx_whatsapp_media_order_id", "whatsapp_media", ["order_id"])


def downgrade():
    op.drop_index("idx_whatsapp_media_order_id", table_name="whatsapp_media")
    op.drop_table("whatsapp_media")
