"""Store reusable WhatsApp response text by intent key."""

import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    templates = op.create_table(
        "whatsapp_reply_templates",
        sa.Column("key", sa.String(60), primary_key=True),
        sa.Column("body", sa.Text(), nullable=False),
    )
    op.bulk_insert(templates, [
        {"key": "greeting", "body": "Hello! 👋 I'm ShopPal, your shopping assistant.\n\nTo see what is available, send “What do you sell?” or tell me what you're looking for."},
        {"key": "catalog_header", "body": "*Here are some items available now:*"},
        {"key": "catalog_footer", "body": "Send the product name and quantity you'd like to order."},
        {"key": "catalog_empty", "body": "There are no items available in this shop right now. Please check back soon."},
    ])


def downgrade():
    op.drop_table("whatsapp_reply_templates")
