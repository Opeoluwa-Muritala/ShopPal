"""Stage 1 schema supplied in the PRD clarification; no commerce behavior."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Identity:
    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )


class Timestamps:
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class Vendor(Identity, Timestamps, Base):
    __tablename__ = "vendors"

    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(20), unique=True)
    whatsapp_number: Mapped[str] = mapped_column(String(20))
    business_name: Mapped[str | None] = mapped_column(String(120))
    paystack_public_key: Mapped[str | None] = mapped_column(String(255))
    bank_account: Mapped[str | None] = mapped_column(String(50))
    greeting_message: Mapped[str | None] = mapped_column(
        Text, server_default=text("'Hey! Welcome to our shop!'")
    )
    preferred_language: Mapped[str | None] = mapped_column(
        String(20), server_default=text("'pidgin'")
    )
    bot_number: Mapped[str | None] = mapped_column(String(20))
    dashboard_url: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))


class Product(Identity, Timestamps, Base):
    __tablename__ = "products"
    __table_args__ = (Index("idx_products_vendor_id", "vendor_id"),)

    vendor_id: Mapped[UUID] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(120))
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    stock: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    image_url: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str | None] = mapped_column(
        String(20), server_default=text("'active'")
    )


class Cart(Identity, Timestamps, Base):
    __tablename__ = "carts"
    __table_args__ = (UniqueConstraint("vendor_id", "customer_phone"),)

    vendor_id: Mapped[UUID] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE")
    )
    customer_phone: Mapped[str] = mapped_column(String(20))
    items: Mapped[list] = mapped_column(JSONB, server_default=text("'[]'"))
    state: Mapped[str | None] = mapped_column(
        String(30), server_default=text("'active'")
    )


class Order(Identity, Timestamps, Base):
    __tablename__ = "orders"
    __table_args__ = (
        Index("idx_orders_vendor_id", "vendor_id"),
        Index("idx_orders_status", "status"),
    )

    order_code: Mapped[str | None] = mapped_column(String(20), unique=True)
    vendor_id: Mapped[UUID] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE")
    )
    customer_phone: Mapped[str] = mapped_column(String(20))
    customer_name: Mapped[str | None] = mapped_column(String(120))
    items: Mapped[list] = mapped_column(JSONB)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    delivery_address: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(String(30), server_default=text("'new'"))
    payment_status: Mapped[str | None] = mapped_column(
        String(30), server_default=text("'pending_payment'")
    )
    paystack_ref: Mapped[str | None] = mapped_column(String(120))


class Conversation(Identity, Base):
    __tablename__ = "conversations"
    __table_args__ = (UniqueConstraint("vendor_id", "customer_phone"),)

    vendor_id: Mapped[UUID] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE")
    )
    customer_phone: Mapped[str] = mapped_column(String(20))
    conversation_state: Mapped[str | None] = mapped_column(
        String(30), server_default=text("'browsing'")
    )
    message_history: Mapped[list] = mapped_column(JSONB, server_default=text("'[]'"))
    language_detected: Mapped[str | None] = mapped_column(String(20))
    messages_this_session: Mapped[int | None] = mapped_column(
        Integer, server_default=text("0")
    )
    last_touched: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class Account(Identity, Timestamps, Base):
    __tablename__ = "accounts"
    __table_args__ = (Index("idx_accounts_vendor_id", "vendor_id"),)

    vendor_id: Mapped[UUID] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        String(20), server_default=text("'owner'"), nullable=False
    )  # owner | staff
    is_active: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RefreshToken(Identity, Base):
    __tablename__ = "refresh_tokens"
    __table_args__ = (Index("idx_refresh_tokens_account_id", "account_id"),)

    account_id: Mapped[UUID] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    device_label: Mapped[str | None] = mapped_column(String(120))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class PasswordResetToken(Identity, Base):
    __tablename__ = "password_reset_tokens"

    account_id: Mapped[UUID] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class WhatsAppMessage(Identity, Base):
    __tablename__ = "whatsapp_messages"

    message_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    from_number: Mapped[str | None] = mapped_column(String(30))
    message_type: Mapped[str] = mapped_column(String(30), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(String(30))
    wa_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    raw_payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    received_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

