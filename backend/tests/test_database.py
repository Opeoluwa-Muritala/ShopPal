from decimal import Decimal

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.db.models import Cart, Conversation, Order, Product, Vendor
from app.db.session import database_url, get_db, get_engine


def make_vendor(session):
    vendor = Vendor(name="Chidinma", phone="08012345678", whatsapp_number="08012345678")
    session.add(vendor)
    session.flush()
    return vendor


def test_postgres_defaults_money_json_and_cascade(db_session):
    vendor = make_vendor(db_session)
    product = Product(
        vendor_id=vendor.id,
        name="Ankara",
        price=Decimal("12500.50"),
        image_url="https://example.com/ankara.jpg",
    )
    cart = Cart(vendor_id=vendor.id, customer_phone="08087654321")
    conversation = Conversation(vendor_id=vendor.id, customer_phone="08087654321")
    order = Order(
        vendor_id=vendor.id,
        customer_phone="08087654321",
        items=[{"name": "Ankara", "qty": 1}],
        total=Decimal("12500.50"),
    )
    db_session.add_all([product, cart, conversation, order])
    db_session.flush()
    assert vendor.is_active is True
    assert vendor.preferred_language == "pidgin"
    assert vendor.greeting_message == "Hey! Welcome to our shop!"
    assert vendor.created_at.tzinfo is not None
    assert product.price == Decimal("12500.50")
    assert product.stock == 0
    assert product.status == "active"
    assert cart.items == [] and cart.state == "active"
    assert conversation.message_history == []
    assert conversation.conversation_state == "browsing"
    assert conversation.messages_this_session == 0
    assert order.status == "new"
    assert order.payment_status == "pending_payment"
    db_session.execute(delete(Vendor).where(Vendor.id == vendor.id))
    for model in (Product, Cart, Conversation, Order):
        assert (
            db_session.scalar(
                select(func.count())
                .select_from(model)
                .where(model.vendor_id == vendor.id)
            )
            == 0
        )


def test_duplicate_vendor_phone_is_rejected(db_session):
    make_vendor(db_session)
    with pytest.raises(IntegrityError), db_session.begin_nested():
        make_vendor(db_session)


@pytest.mark.parametrize("model", [Cart, Conversation])
def test_customer_vendor_pair_is_unique(db_session, model):
    vendor = make_vendor(db_session)
    db_session.add(model(vendor_id=vendor.id, customer_phone="08087654321"))
    db_session.flush()
    with pytest.raises(IntegrityError), db_session.begin_nested():
        db_session.add(model(vendor_id=vendor.id, customer_phone="08087654321"))
        db_session.flush()


def test_database_url_rejects_other_database_types():
    with pytest.raises(ValueError, match="PostgreSQL"):
        database_url("sqlite:///test.db")


def test_engine_requires_database_url(monkeypatch):
    from app.config import Settings

    monkeypatch.setattr(
        "app.db.session.get_settings",
        lambda: Settings(
            _env_file=None,
            database_url=None,
        ),
    )
    get_engine.cache_clear()
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        get_engine()


def test_session_dependency_uses_postgres_and_closes(test_engine, monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL", test_engine.url.render_as_string(hide_password=False)
    )
    get_settings.cache_clear()
    get_engine.cache_clear()
    try:
        engine = get_engine()
        assert get_engine() is engine
        dependency = get_db()
        session = next(dependency)
        assert session.scalar(select(1)) == 1
        with pytest.raises(StopIteration):
            next(dependency)
        engine.dispose()
    finally:
        get_engine.cache_clear()
        get_settings.cache_clear()
