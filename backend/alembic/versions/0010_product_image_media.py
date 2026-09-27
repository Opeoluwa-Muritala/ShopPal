"""link compressed product images to stored WhatsApp media"""

import sqlalchemy as sa

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "products",
        sa.Column("image_media_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_products_image_media_id",
        "products",
        "whatsapp_media",
        ["image_media_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "idx_products_image_media_id",
        "products",
        ["image_media_id"],
    )


def downgrade():
    op.drop_index("idx_products_image_media_id", table_name="products")
    op.drop_constraint(
        "fk_products_image_media_id",
        "products",
        type_="foreignkey",
    )
    op.drop_column("products", "image_media_id")
