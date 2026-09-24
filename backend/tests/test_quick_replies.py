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
