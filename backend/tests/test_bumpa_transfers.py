"""Transfer fallback tests without Bumpa, Meta, or database connections."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.services import bumpa_transfers
from app.services.bumpa_transfers import TransferService
from tests.test_bumpa_conversation import FakeWhatsApp


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
        proof_media_id=None, created_at=datetime.now(UTC), resolved_at=None,
    )
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


@pytest.mark.anyio
async def test_only_owner_can_confirm_or_reject_transfer():
    shop = merchant()
    row = SimpleNamespace(
        reference="SHP-4F2K", merchant_id=shop.id, customer_wa_id="2348022222222",
        status="proof_received", resolved_at=None,
    )
    session = FakeSession(row)
    transfer = service(session)
    whatsapp = FakeWhatsApp()
    forged = {"from": "2348099999999", "type": "text", "text": {"body": "CONFIRM SHP-4F2K"}}
    assert not await transfer.owner_action(shop, forged, whatsapp)
    assert row.status == "proof_received"
    genuine = {**forged, "from": "2348011111111"}
    assert await transfer.owner_action(shop, genuine, whatsapp)
    assert row.status == "confirmed"
    assert any("record the sale in your Bumpa app" in sent[2] for sent in whatsapp.sent)
    assert any("owner will send your invoice" in sent[2] for sent in whatsapp.sent)


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
