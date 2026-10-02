"""Focused tests for the in-WhatsApp virtual-account payment state machine."""

import asyncio
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

from pydantic import SecretStr

from app.config import Settings
from app.services.flutterwave_v4 import VerifiedCharge
from app.services.payments import confirm_verified_charge
from app.services.payments import _confirmation_caption
from app.routers.flutterwave import _signature_is_valid
from app.routers.whatsapp_webhook import _extract_payment_actions


class FakeProvider:
    def __init__(self, charge):
        self.charge = charge

    async def verify_charge(self, _transaction_id):
        return self.charge


class FakeTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False


class FakeSession:
    def __init__(self, order):
        self.order = order

    async def scalar(self, _query):
        return self.order

    def begin(self):
        return FakeTransaction()


def settings():
    return Settings(_env_file=None, flw_webhook_secret_hash=SecretStr("hook"))


def test_flutterwave_signature_uses_constant_time_value_match():
    assert _signature_is_valid("hook", "hook") is True
    assert _signature_is_valid("forged", "hook") is False
    assert _signature_is_valid(None, "hook") is False


def test_receipt_action_buttons_are_extracted_for_the_payment_handler():
    payload = {"entry": [{"changes": [{"value": {
        "metadata": {"display_phone_number": "2349110501393"},
        "messages": [{
            "from": "2347064408491",
            "interactive": {"button_reply": {
                "id": "receipt_reorder:ord-demo",
                "title": "Order again",
            }},
        }],
    }}]}]}
    assert _extract_payment_actions(payload) == [
        ("reorder", "ord-demo", "2347064408491", "2349110501393")
    ]


def test_verified_charge_marks_order_paid_once(monkeypatch):
    order = SimpleNamespace(
        tx_ref="ord-abc", total=Decimal("1500.00"), currency="NGN", payment_status="pending_payment",
        status="pending", expires_at=datetime.now(UTC) + timedelta(minutes=10), wa_number="2348012345678",
        customer_phone="2348012345678", paid_at=None, payment_transaction_id=None, fw_transaction_id=None,
        payment_confirmation_source=None,
    )
    sent = []
    async def send(*args, **kwargs):
        sent.append(args)
    monkeypatch.setattr("app.services.payments.send_whatsapp_text", send)
    result = asyncio.run(confirm_verified_charge(FakeSession(order), transaction_id="chg_1", payload={}, settings=settings(), provider=FakeProvider(VerifiedCharge("chg_1", "ord-abc", "succeeded", "NGN", Decimal("1500")))))
    assert result == "paid"
    assert order.payment_status == "paid"
    assert order.status == "paid"
    assert order.payment_transaction_id == "chg_1"
    assert len(sent) == 1


def test_wrong_amount_moves_order_to_review_without_fulfilment(monkeypatch):
    order = SimpleNamespace(
        tx_ref="ord-review", total=Decimal("1500.00"), currency="NGN", payment_status="pending_payment",
        status="pending", expires_at=datetime.now(UTC) + timedelta(minutes=10), wa_number="2348012345678",
        customer_phone="2348012345678", paid_at=None, payment_transaction_id=None, fw_transaction_id=None,
        payment_confirmation_source=None,
    )
    sent = []
    async def send(*args, **kwargs):
        sent.append(args)
    monkeypatch.setattr("app.services.payments.send_whatsapp_text", send)
    result = asyncio.run(confirm_verified_charge(FakeSession(order), transaction_id="chg_2", payload={}, settings=settings(), provider=FakeProvider(VerifiedCharge("chg_2", "ord-review", "succeeded", "NGN", Decimal("1499")))))
    assert result == "review"
    assert order.payment_status == "review"
    assert order.status == "review"
    assert order.payment_transaction_id is None
    assert len(sent) == 1


def test_receipt_caption_keeps_action_url_out_of_image_text():
    order = SimpleNamespace(tx_ref="ord-help", total=Decimal("2500.00"))
    caption = _confirmation_caption(order)
    assert "Payment received" in caption
    assert "₦2,500.00" in caption
    assert "https://" not in caption
