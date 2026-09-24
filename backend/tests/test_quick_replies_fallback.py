from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

from app.services.quick_replies import ai_failure_reply


def test_ai_failure_uses_numbered_shopping_menu_for_unknown_request():
    session = Mock()
    session.execute.return_value.all.return_value = []
    reply = ai_failure_reply(session, SimpleNamespace(id=uuid4()), "Do something unusual")
    assert "1 — See available products" in reply
    assert "temporarily" not in reply.lower()
    assert "2 — View my cart" in reply
    assert "3 — Checkout" in reply


def test_ai_failure_guides_checkout_without_ai():
    session = Mock()
    session.execute.return_value.all.return_value = []
    reply = ai_failure_reply(session, SimpleNamespace(id=uuid4()), "I want to checkout")
    assert "delivery address" in reply
    assert "payment details" in reply


def test_numbered_commands_are_executed_from_database(monkeypatch):
    session = Mock()
    session.execute.return_value.all.return_value = []
    session.scalars.return_value.all.return_value = []
    vendor = SimpleNamespace(id=uuid4())
    assert "no items available" in ai_failure_reply(session, vendor, "1", "2348000000000")
    monkeypatch.setattr(
        "app.services.quick_replies.CustomerToolDispatcher.view_cart",
        lambda self, args: {"items": [], "total": "0.00"},
    )
    assert "cart is empty" in ai_failure_reply(session, vendor, "2", "2348000000000")
    assert "cart is empty" in ai_failure_reply(session, vendor, "3", "2348000000000")
