"""Transfer fallback tests without Bumpa, Meta, or database connections."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.services import bumpa_transfers
from app.services.bumpa_transfers import TransferService


@pytest.fixture
def anyio_backend():
    return "asyncio"


class FakeSession:
    def __init__(self, row=None, merchant=None):
        self.row = row
        self.merchant = merchant
        self.commits = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def scalar(self, *_args):
        return self.row

    async def scalars(self, *_args):
        return SimpleNamespace(all=lambda: [self.row] if self.row else [])

    async def get(self, *_args):
        return self.merchant

    async def commit(self):
        self.commits += 1


class FakeWhatsApp:
    def __init__(self):
        self.sent: list[tuple[str, str, str]] = []

    async def send_text(self, to: str, body: str):
        self.sent.append(("text", to, body))

    async def send_buttons(self, to: str, body: str, _buttons):
        self.sent.append(("buttons", to, body))

    async def send_template(self, to: str, _name: str, _language: str, _components):
        self.sent.append(("template", to, "template"))


def merchant():
    return SimpleNamespace(
        id=uuid4(), owner_whatsapp_number="+2348011111111",
        payout_bank_name="Example Bank", payout_account_name="Shop Owner",
        payout_account_number="1234567890", whatsapp_phone_number_id="123456789",
        whatsapp_token_enc=None,
    )


def service(session):
    result = TransferService.__new__(TransferService)
    result.sessions = lambda: session
    result.http = None
    result.on_confirm = None
    result.settings = SimpleNamespace(
        email_api_url="",
        owner_alert_email="",
        whatsapp_template_owner_transfer_alert="",
        whatsapp_template_transfer_expiry="",
        whatsapp_template_owner_transfer_expiry="",
    )
    return result


@pytest.mark.anyio
async def test_transfer_sends_bank_only_after_choice_and_never_persists_proof_image(monkeypatch):
    shop = merchant()
    session = FakeSession()
    transfer = service(session)
    whatsapp = FakeWhatsApp()
    product = SimpleNamespace(name="Sneakers", price=Decimal("5000"), currency="NGN", stock_qty=4, is_published=True)
    monkeypatch.setattr(bumpa_transfers, "refresh_product_live", AsyncMock(return_value=(product, False)))
    monkeypatch.setattr(bumpa_transfers, "has_open_capacity", AsyncMock(return_value=True))
    row = SimpleNamespace(
        reference="SHP-4F2K", merchant_id=shop.id, bumpa_product_id="p1", quantity=1,
        amount=Decimal("5000"), customer_wa_id="2348022222222", status="awaiting_proof",
        proof_media_id=None, created_at=datetime.now(UTC), resolved_at=None, items=[
            {"product_id": "p1", "name": "Sneakers", "qty": 2},
            {"type": "delivery", "name": "Door delivery", "address": "12 Main St, Lagos"},
            {"type": "customer", "name": "Ada Okafor", "phone": "08022222222"},
        ],
    )
    send_email_mock = AsyncMock()
    monkeypatch.setattr(bumpa_transfers, "send_email", send_email_mock)
    monkeypatch.setattr(bumpa_transfers, "save_pending_transfer", AsyncMock(return_value=row))
    assert whatsapp.sent == []
    created = await transfer.create(shop, row.customer_wa_id, "p1", 1, whatsapp)
    assert created is row
    assert "1234567890" in whatsapp.sent[-1][2]
    assert "SHP-4F2K" in whatsapp.sent[-1][2]
    session.row = row
    image = {"from": row.customer_wa_id, "type": "image", "image": {"id": "media-1"}}
    assert await transfer.customer_proof(shop, image, whatsapp)
    assert row.status == "proof_received"
    assert row.proof_media_id == "media-1"
    assert "never proof of payment" in whatsapp.sent[-1][2]
    assert "1234567890" not in whatsapp.sent[-1][2]
    send_email_mock.assert_awaited_once()
    assert "receipt screenshot" in send_email_mock.await_args.args[4]


@pytest.mark.anyio
async def test_paid_text_alert_keeps_whatsapp_owner_notice_and_sends_email(monkeypatch):
    shop = merchant()
    row = SimpleNamespace(
        reference="SHP-4F2K", merchant_id=shop.id, bumpa_product_id="p1", quantity=1,
        amount=Decimal("5000"), customer_wa_id="2348022222222", status="awaiting_proof",
        proof_media_id=None, created_at=datetime.now(UTC), resolved_at=None,
    )
    session = FakeSession(row)
    transfer = service(session)
    transfer.http = AsyncMock()
    transfer.settings.email_api_url = "https://emailope.vercel.app/"
    transfer.settings.owner_alert_email = "owner@example.com"
    transfer.settings.public_base_url = "https://shop.example"
    transfer.settings.key_encryption_secret = SimpleNamespace(get_secret_value=lambda: "test-secret")
    whatsapp = FakeWhatsApp()
    send_email_mock = AsyncMock()
    monkeypatch.setattr(bumpa_transfers, "send_email", send_email_mock)
    paid = {"from": row.customer_wa_id, "type": "text", "text": {"body": "I've paid"}}
    assert await transfer.customer_proof(shop, paid, whatsapp)
    assert any("never proof of payment" in sent[2] for sent in whatsapp.sent)
    send_email_mock.assert_awaited_once()
    assert "Confirm payment" in send_email_mock.await_args.kwargs["html"]
    assert "Reject payment" in send_email_mock.await_args.kwargs["html"]
    assert "Buyer details" in send_email_mock.await_args.kwargs["html"]
    assert "Items bought" in send_email_mock.await_args.kwargs["html"]
    assert "Ada Okafor" in send_email_mock.await_args.kwargs["html"]
    assert "Sneakers" in send_email_mock.await_args.kwargs["html"]
    assert "Ada Okafor" in send_email_mock.await_args.args[4]
    assert "Sneakers x 2" in send_email_mock.await_args.args[4]

    image = {"from": row.customer_wa_id, "type": "image", "image": {"id": "media-1"}}
    assert await transfer.customer_proof(shop, image, whatsapp)
    send_email_mock.assert_awaited_once()


@pytest.mark.anyio
async def test_screenshot_alert_precedes_customer_reply_and_paid_text_does_not_duplicate_it(monkeypatch):
    shop = merchant()
    row = SimpleNamespace(
        reference="SHP-4F2K", merchant_id=shop.id, bumpa_product_id="p1", quantity=1,
        amount=Decimal("5000"), customer_wa_id="2348022222222", status="awaiting_proof",
        proof_media_id=None, items=[],
    )
    transfer = service(FakeSession(row))
    whatsapp = FakeWhatsApp()
    send_email_mock = AsyncMock()
    monkeypatch.setattr(bumpa_transfers, "send_email", send_email_mock)

    whatsapp.send_buttons = AsyncMock(side_effect=RuntimeError("WhatsApp unavailable"))
    image = {"from": row.customer_wa_id, "type": "image", "image": {"id": "media-1"}}
    with pytest.raises(RuntimeError, match="WhatsApp unavailable"):
        await transfer.customer_proof(shop, image, whatsapp)
    send_email_mock.assert_awaited_once()
    assert "receipt screenshot" in send_email_mock.await_args.args[4]

    whatsapp.send_buttons = AsyncMock()
    paid = {"from": row.customer_wa_id, "type": "text", "text": {"body": "I've paid"}}
    assert await transfer.customer_proof(shop, paid, whatsapp)
    send_email_mock.assert_awaited_once()


@pytest.mark.anyio
async def test_only_owner_can_confirm_or_reject_transfer(monkeypatch):
    shop = merchant()
    row = SimpleNamespace(
        reference="SHP-4F2K", merchant_id=shop.id, customer_wa_id="2348022222222",
        status="proof_received", resolved_at=None,
    )
    session = FakeSession(row)
    transfer = service(session)
    send_email_mock = AsyncMock()
    monkeypatch.setattr(bumpa_transfers, "send_email", send_email_mock)
    whatsapp = FakeWhatsApp()
    forged = {"from": "2348099999999", "type": "text", "text": {"body": "CONFIRM SHP-4F2K"}}
    assert not await transfer.owner_action(shop, forged, whatsapp)
    assert row.status == "proof_received"
    genuine = {**forged, "from": "2348011111111"}
    assert await transfer.owner_action(shop, genuine, whatsapp)
    assert row.status == "confirmed"
    assert any("record the sale in your Bumpa app" in sent[2] for sent in whatsapp.sent)
    assert any("owner will send your invoice" in sent[2] for sent in whatsapp.sent)
    send_email_mock.assert_not_awaited()


@pytest.mark.anyio
async def test_owner_template_contains_checkout_details_and_reject_action():
    shop = merchant()
    row = SimpleNamespace(
        reference="SHP-4F2K", merchant_id=shop.id, bumpa_product_id="p1", quantity=2,
        amount=Decimal("10500"), customer_wa_id="2348022222222", status="awaiting_proof",
        proof_media_id=None, items=[
            {"product_id": "p1", "name": "Sneakers", "qty": 2},
            {"type": "delivery", "name": "Door delivery", "address": "12 Main St, Lagos"},
            {"type": "customer", "name": "Ada Okafor", "phone": "08022222222"},
        ],
    )
    session = FakeSession(row)
    transfer = service(session)
    transfer.settings.whatsapp_template_owner_transfer_alert = "owner_transfer_alert"
    whatsapp = FakeWhatsApp()
    whatsapp.send_template = AsyncMock()
    assert await transfer.customer_proof(shop, {"from": row.customer_wa_id, "type": "text", "text": {"body": "paid"}}, whatsapp)
    params = whatsapp.send_template.await_args.args[3]
    assert params == ["SHP-4F2K", "Ada Okafor", "08022222222", "2348022222222",
                      "Sneakers x 2", "NGN 10,500.00", "Door delivery", "12 Main St, Lagos"]
    assert whatsapp.send_template.await_args.kwargs["buttons"] == ["CONFIRM SHP-4F2K", "REJECT SHP-4F2K"]
    assert not await transfer.owner_action(shop, {"from": row.customer_wa_id, "type": "button", "button": {"payload": "CONFIRM SHP-4F2K"}}, whatsapp)
    assert row.status == "proof_received"
    assert await transfer.owner_action(shop, {"from": "2348011111111", "type": "button", "button": {"payload": "REJECT SHP-4F2K"}}, whatsapp)
    assert row.status == "rejected"


@pytest.mark.anyio
async def test_expiry_marks_open_transfer_and_notifies_both_parties(monkeypatch):
    shop = merchant()
    row = SimpleNamespace(
        reference="SHP-4F2K", merchant_id=shop.id, customer_wa_id="2348022222222",
        status="awaiting_proof", created_at=datetime.now(UTC) - timedelta(hours=25), resolved_at=None,
    )
    session = FakeSession(row, shop)
    transfer = service(session)
    whatsapp = FakeWhatsApp()
    monkeypatch.setattr(transfer, "client_for", lambda _merchant: whatsapp)
    transfer.settings.whatsapp_template_transfer_expiry = "customer_expiry"
    transfer.settings.whatsapp_template_owner_transfer_expiry = "owner_expiry"
    whatsapp.send_template = AsyncMock()
    assert await transfer.expire() == 1
    assert row.status == "expired"
    assert whatsapp.send_template.await_count == 2
    assert {call.args[0] for call in whatsapp.send_template.await_args_list} == {row.customer_wa_id, shop.owner_whatsapp_number}
