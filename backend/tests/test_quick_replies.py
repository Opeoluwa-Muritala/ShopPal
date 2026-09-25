from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql

from app.services.quick_replies import quick_intent, quick_reply


@pytest.mark.parametrize("message", ["hello", " HI! ", "Good morning 👋"])
def test_greetings_use_template_without_product_query(message):
    session = Mock()
    session.execute.return_value.all.return_value = []
    reply = quick_reply(session, SimpleNamespace(id=uuid4()), [message])
    assert "ShopPal" in reply
    assert "Naija Marketplace" not in reply
    session.scalars.assert_not_called()


@pytest.mark.parametrize("message", ["hello, what do you sell?", "what do you have in stock", "catalog"])
def test_catalog_uses_vendor_scoped_stock_and_whatsapp_format(message):
    vendor = SimpleNamespace(id=uuid4())
    session = Mock()
    session.execute.return_value.all.return_value = []
    session.scalars.return_value.all.return_value = [
        SimpleNamespace(name="Oud\n*perfume*", price=Decimal("12000")),
    ]
    reply = quick_reply(session, vendor, [message])
    assert "1. Oud perfume" in reply
    query = session.scalars.call_args.args[0].compile(dialect=postgresql.dialect())
    assert vendor.id in query.params.values()
    assert "products.vendor_id =" in str(query)
    assert "products.status =" in str(query)
    assert "products.stock >" in str(query)


def test_complex_messages_and_pending_questions_keep_ai_path():
    session = Mock()
    vendor = SimpleNamespace(id=uuid4())
    assert quick_intent("hello add two bottles") is None
    assert quick_reply(session, vendor, ["add two bottles", "hello"]) is None
    session.scalars.assert_not_called()


def test_empty_catalog_does_not_invent_products():
    session = Mock()
    session.execute.return_value.all.return_value = []
    session.scalars.return_value.all.return_value = []
    assert "no items available" in quick_reply(session, SimpleNamespace(id=uuid4()), ["what do you sell"])


def test_saved_template_is_used_for_greeting():
    session = Mock()
    session.execute.return_value.all.return_value = [("greeting", "Welcome to ShopPal!")]
    assert quick_reply(session, SimpleNamespace(id=uuid4()), ["hello"]) == "Welcome to ShopPal!"


@pytest.mark.parametrize(
    ("message", "expected_quantity", "expected_name"),
    [
        ("10 velvet rose", 10, "Velvet Rose 50ml"),
        ("Midnight musk quantity 4", 4, "Midnight Musk 50ml"),
        ("I want to buy three midnight musk", 3, "Midnight Musk 50ml"),
    ],
)
def test_explicit_product_quantity_is_added_before_ai(monkeypatch, message, expected_quantity, expected_name):
    vendor = SimpleNamespace(id=uuid4())
    products = [
        SimpleNamespace(id=uuid4(), name="Midnight Musk 50ml", stock=20),
        SimpleNamespace(id=uuid4(), name="Velvet Rose 50ml", stock=20),
    ]
    session = Mock()
    session.scalars.return_value.all.return_value = products
    added = {}

    class FakeDispatcher:
        def __init__(self, *_args, **_kwargs):
            pass

        def add_to_cart(self, args):
            added.update(args)
            return {
                "items": [{"name": expected_name, "qty": args["quantity"], "price": "15500"}],
                "total": str(args["quantity"] * 15500),
            }

    monkeypatch.setattr("app.services.quick_replies.CustomerToolDispatcher", FakeDispatcher)
    reply = quick_reply(
        session,
        vendor,
        [message],
        customer_phone="2348000000000",
        history=[],
    )

    assert f"Added {expected_quantity} of {expected_name}" in reply
    assert added["quantity"] == expected_quantity


def test_quantity_uses_the_last_selected_product(monkeypatch):
    vendor = SimpleNamespace(id=uuid4())
    product = SimpleNamespace(id=uuid4(), name="Velvet Rose 50ml", stock=20)
    session = Mock()
    session.scalars.return_value.all.return_value = [product]
    added = {}

    class FakeDispatcher:
        def __init__(self, *_args, **_kwargs):
            pass

        def add_to_cart(self, args):
            added.update(args)
            return {"items": [{"name": product.name, "qty": 10, "price": "15500"}], "total": "155000"}

    monkeypatch.setattr("app.services.quick_replies.CustomerToolDispatcher", FakeDispatcher)
    reply = quick_reply(
        session,
        vendor,
        ["10"],
        customer_phone="2348000000000",
        history=[
            {"role": "assistant", "content": "You selected Velvet Rose 50ml. How many would you like?"}
        ],
    )

    assert "Added 10 of Velvet Rose 50ml" in reply
    assert added["productId"] == str(product.id)
    assert added["quantity"] == 10


def test_catalog_number_is_resolved_without_ai(monkeypatch):
    vendor = SimpleNamespace(id=uuid4())
    product = SimpleNamespace(id=uuid4(), name="Velvet Rose 50ml", stock=20)
    session = Mock()
    session.scalars.return_value.all.return_value = [product]
    monkeypatch.setattr(
        "app.services.quick_replies.CustomerToolDispatcher",
        lambda *_args, **_kwargs: None,
    )

    reply = quick_reply(
        session,
        vendor,
        ["5"],
        customer_phone="2348000000000",
        history=[
            {
                "role": "assistant",
                "content": (
                    "1. Oud Royale 50ml\n2. Lagos Bloom 50ml\n3. Midnight Musk 50ml\n"
                    "4. Citrus Rush 30ml\n5. Velvet Rose 50ml — ₦15,500.00"
                ),
            }
        ],
    )

    assert reply == "You selected Velvet Rose 50ml. How many would you like?"
