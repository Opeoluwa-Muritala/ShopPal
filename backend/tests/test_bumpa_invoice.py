"""Invoice-link and plain confirmation branches use hand-written response shapes."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.integrations.bumpa.mappers import extract_customer_first_name
from app.services import bumpa_invoice
from app.services.bumpa_invoice import InvoiceNotifier
from tests.test_bumpa_conversation import FakeWhatsApp


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _notifier():
    notifier = InvoiceNotifier.__new__(InvoiceNotifier)
    notifier.sessions = None
    notifier.http = None
    notifier.settings = None
    return notifier


def _context():
    merchant = SimpleNamespace(id=uuid4(), owner_whatsapp_number="2348011111111")
    ref = SimpleNamespace(
        customer_wa_id="2348022222222", bumpa_checkout_id="checkout-1",
        bumpa_order_id="order-1", payment_reference="PAYREF",
    )
    return merchant, ref, FakeWhatsApp()


@pytest.mark.anyio
async def test_invoice_url_from_order_is_sent_as_bumpa_invoice(monkeypatch):
    merchant, ref, whatsapp = _context()
    bumpa = SimpleNamespace(
        has_secret_key=True,
        get_checkout=AsyncMock(return_value={"id": "checkout-1", "payment_status": "paid"}),
        list_orders=AsyncMock(return_value={"orders": [{
            "order_id": "order-1", "invoice_url": "https://bumpa.example/invoice/1",
            "amount": "5000.00", "currency": "NGN", "customer": {"first_name": "Ada", "last_name": "Nwosu"},
        }]}),
    )
    monkeypatch.setattr(bumpa_invoice, "_client_for_merchant", AsyncMock(return_value=bumpa))
    await _notifier()(merchant, ref, {"order_id": "order-1"}, whatsapp)
    assert "Bumpa invoice: https://bumpa.example/invoice/1" in whatsapp.sent[0][2]
    assert "NGN 5,000.00" in whatsapp.sent[0][2]
    assert "Ada" in whatsapp.sent[1][2]
    assert "Nwosu" not in whatsapp.sent[1][2]
    assert extract_customer_first_name({"customer_context": {"first_name": "Ada"}}) == "Ada"


@pytest.mark.anyio
async def test_absent_invoice_is_plainly_labelled_shoppal_confirmation(monkeypatch):
    merchant, ref, whatsapp = _context()
    bumpa = SimpleNamespace(
        has_secret_key=False,
        get_checkout=AsyncMock(return_value={"checkout_id": "checkout-1", "payment_status": "paid"}),
    )
    monkeypatch.setattr(bumpa_invoice, "_client_for_merchant", AsyncMock(return_value=bumpa))
    await _notifier()(merchant, ref, {"order_id": "order-1", "amount": str(Decimal("5000")), "currency": "NGN"}, whatsapp)
    assert whatsapp.sent[0][2].startswith("Shoppal payment confirmation:")
    assert "Bumpa invoice" not in whatsapp.sent[0][2]
    assert "NGN 5,000.00" in whatsapp.sent[0][2]
