"""Store complete WhatsApp transfer baskets."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pending_transfers", sa.Column("items", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("pending_transfers", "items")
