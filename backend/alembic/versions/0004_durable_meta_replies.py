"""Durable Meta reply jobs and transactional tool checkpoints."""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "whatsapp_reply_jobs",
        sa.Column(
            "id",
            sa.UUID(),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "message_id",
            sa.String(255),
            sa.ForeignKey("whatsapp_messages.message_id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("vendor_id", sa.UUID(), sa.ForeignKey("vendors.id")),
        sa.Column("customer_phone", sa.String(30), nullable=False),
        sa.Column("phone_number_id", sa.String(40), nullable=False),
        sa.Column("display_number", sa.String(40), nullable=False),
        sa.Column("state", sa.String(30), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column(
            "next_attempt_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("lease_owner", sa.String(36)),
        sa.Column("lease_until", sa.DateTime(timezone=True)),
        sa.Column("transcript", JSONB(), nullable=False),
        sa.Column("pending_action", JSONB()),
        sa.Column("reply_text", sa.Text()),
        sa.Column("outbound_message_id", sa.String(255), unique=True),
        sa.Column("failure_category", sa.String(60)),
        *[
            sa.Column(name, sa.DateTime(timezone=True))
            for name in ("accepted_at", "delivered_at", "read_at")
        ],
        *[
            sa.Column(name, sa.DateTime(timezone=True), server_default=sa.text("now()"))
            for name in ("created_at", "updated_at")
        ],
    )
    op.create_index(
        "idx_reply_jobs_due", "whatsapp_reply_jobs", ["state", "next_attempt_at"]
    )
    op.create_table(
        "whatsapp_reply_tool_results",
        sa.Column(
            "id",
            sa.UUID(),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "job_id",
            sa.UUID(),
            sa.ForeignKey("whatsapp_reply_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("call_index", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(40), nullable=False),
        sa.Column("arguments", JSONB(), nullable=False),
        sa.Column("result", JSONB(), nullable=False),
        sa.UniqueConstraint("job_id", "call_index"),
    )


def downgrade():
    op.drop_table("whatsapp_reply_tool_results")
    op.drop_table("whatsapp_reply_jobs")
