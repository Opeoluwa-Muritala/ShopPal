"""Payment polling schedule and idempotent finalization transitions."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.services import bumpa_payments
from app.services.bumpa_payments import PaymentTracker, next_poll
from tests.test_bumpa_conversation import FakeWhatsApp


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _tracker(monkeypatch, *, age_seconds=0):
    now = datetime.now(UTC)
    merchant = SimpleNamespace(id=uuid4(), catalog_provider="bumpa", owner_whatsapp_number="2348011111111")
    ref = SimpleNamespace(
        id=uuid4(), merchant_id=merchant.id, customer_wa_id="2348022222222",
        bumpa_checkout_id="checkout-1", bumpa_order_id="order-1", payment_reference="PAYREF",
        status="awaiting_payment", created_at=now - timedelta(seconds=age_seconds),
    )
    tracker = PaymentTracker.__new__(PaymentTracker)
    tracker.sessions = None
    tracker.http = None
    tracker.settings = None
    tracker.notify_paid = AsyncMock()
    client = FakeWhatsApp()
    tracker.transfers = SimpleNamespace(client_for=lambda _merchant: client)
    tracker._claim = AsyncMock(return_value=(ref, merchant))
    tracker._mark = AsyncMock()
    return tracker, merchant, ref, client, now


def test_payment_poll_schedule_switches_after_two_minutes_and_expires_at_twenty():
    now = datetime.now(UTC)
    assert next_poll(now - timedelta(seconds=90), now) == now + timedelta(seconds=15)
    assert next_poll(now - timedelta(minutes=3), now) == now + timedelta(seconds=60)
    assert next_poll(now - timedelta(minutes=20), now) is None


@pytest.mark.anyio
async def test_pending_then_paid_finalizes_once_and_notifies(monkeypatch):
    tracker, merchant, ref, client, now = _tracker(monkeypatch)
    status = AsyncMock(side_effect=["pending", "paid"])
    finalized = AsyncMock(return_value={"order_id": "order-1"})
    monkeypatch.setattr(bumpa_payments, "check_payment", status)
    monkeypatch.setattr(bumpa_payments, "finalize", finalized)
    assert await tracker.poll_one(now=now) == "pending"
    assert await tracker.poll_one(now=now) == "paid"
    finalized.assert_awaited_once()
    tracker.notify_paid.assert_awaited_once_with(merchant, ref, {"order_id": "order-1"}, client)
    assert tracker._mark.await_args.kwargs["status"] == "paid"


@pytest.mark.anyio
async def test_finalize_pending_422_remains_pending_and_expiry_checks_first(monkeypatch):
    tracker, _merchant, _ref, _client, now = _tracker(monkeypatch, age_seconds=1200)
    monkeypatch.setattr(bumpa_payments, "check_payment", AsyncMock(return_value="paid"))
    monkeypatch.setattr(bumpa_payments, "finalize", AsyncMock(return_value=None))
    assert await tracker.poll_one(now=now) == "pending"
    tracker.notify_paid.assert_not_awaited()
    assert tracker._mark.await_args.kwargs["next_poll_at"] == now + timedelta(minutes=1)


@pytest.mark.anyio
async def test_expiry_message_offers_resend_without_claiming_payment(monkeypatch):
    tracker, _merchant, _ref, client, now = _tracker(monkeypatch, age_seconds=1201)
    monkeypatch.setattr(bumpa_payments, "check_payment", AsyncMock(return_value="pending"))
    assert await tracker.poll_one(now=now) == "expired"
    assert "RESEND" in client.sent[-1][2]
