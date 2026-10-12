"""Conversation transitions without storing customer details in the database."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from app.services import bumpa_conversation
from app.services.bumpa_assistant import ShoppingIntent
from app.services.bumpa_checkout import CheckoutPostcodeRequired, CheckoutResult
from app.services.bumpa_conversation import BumpaConversation


@pytest.fixture
def anyio_backend():
    return "asyncio"


class FakeWhatsApp:
    def __init__(self):
        self.sent = []

    async def send_text(self, to, body):
        self.sent.append(("text", to, body))

    async def send_buttons(self, to, body, buttons):
        self.sent.append(("buttons", to, body, buttons))

    async def send_list(self, to, body, rows):
        self.sent.append(("list", to, body, rows))


class FakeSession:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None


class ConversationHarness(BumpaConversation):
    def __init__(self, merchant, product, client):
        self._sessions = lambda: FakeSession()
        self._http = None
        self._settings = None
        self._details = {}
        self._transfers = SimpleNamespace(
            owner_action=AsyncMock(return_value=False),
            customer_proof=AsyncMock(return_value=False),
            create=AsyncMock(return_value=None),
        )
        self.state = SimpleNamespace(merchant_id=merchant.id, customer_wa_id="2348012345678", step="start", payload={})
        self.product = product
        self.client = client
        self.saved_payloads = []

    async def _client(self, _merchant):
        return self.client

    async def _state(self, _merchant_id, _wa_id):
        return self.state

    async def _set_state(self, _state, step, payload):
        self.saved_payloads.append(dict(payload))
        self.state.step = step
        self.state.payload = dict(payload)

    async def _product(self, _merchant, _product_id):
        return self.product, False

    async def _menu(self, _merchant, wa_id, client, **_kwargs):
        await client.send_list(wa_id, "Choose a product", [("product:p1", "Sneakers")])


def _message(body):
    return {"from": "2348012345678", "type": "text", "text": {"body": body}}


@pytest.mark.anyio
async def test_gemma_selection_runs_live_product_validation_before_payment_options():
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Droid")
    product = SimpleNamespace(bumpa_product_id="p1", name="Bag", price=Decimal("5000"), currency="NGN", stock_qty=4, is_published=True, variations=[])
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, product, whatsapp)
    session = FakeSession()
    session.scalars = AsyncMock(return_value=SimpleNamespace(all=lambda: [product]))
    flow._sessions = lambda: session
    flow._assistant = SimpleNamespace(
        enabled=True, interpret=AsyncMock(return_value=ShoppingIntent(action="select", product_id="p1", quantity=2)),
        phrase=AsyncMock(side_effect=lambda _key, body, _business: body), record=Mock(),
    )
    flow._product = AsyncMock(return_value=(product, False))
    await flow(merchant, _message("I'll take two of that bag"))
    flow._product.assert_awaited_once_with(merchant, "p1")
    assert flow.state.step == "payment_method" and flow.state.payload["qty"] == 2
    assert whatsapp.sent[-1][0] == "buttons"
    assert "5,000.00" in whatsapp.sent[-1][2]
    assert all("account" not in str(row).lower() for row in whatsapp.sent)


@pytest.mark.anyio
async def test_pickup_checkout_collects_details_one_question_at_a_time(monkeypatch):
    merchant = SimpleNamespace(id=uuid4(), business_name="Shop", name="Shop", pickup_location_id="pickup-1", delivery_enabled=True)
    product = SimpleNamespace(bumpa_product_id="p1", name="Sneakers", price=Decimal("5000"), currency="NGN", stock_qty=4, is_published=True, variations=[])
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, product, whatsapp)
    checkout = AsyncMock(return_value=CheckoutResult("internal-id", "order-1", "https://pay.example/only", "PAYREF", Decimal("5000"), "NGN", uuid4()))
    monkeypatch.setattr(bumpa_conversation, "start_checkout", checkout)
    monkeypatch.setattr(bumpa_conversation, "has_open_capacity", AsyncMock(return_value=True))

    for body, expected_step in [
        ("hi", "start"), ("product:p1", "quantity"), ("1", "payment_method"),
        ("pay_online", "full_name"), ("Ada Nwosu", "email"),
        ("ada@example.com", "fulfilment"),
        ("pickup", "confirm"), ("confirm", "start"),
    ]:
        await flow(merchant, _message(body))
        assert flow.state.step == expected_step

    args = checkout.await_args.args
    assert args[4].first_name == "Ada"
    assert args[4].email == "ada@example.com"
    assert args[4].phone == "+2348012345678"
    assert args[5].type == "pickup"
    assert args[5].pickup_location_id == "pickup-1"
    assert not flow._details
    assert all("Ada" not in str(payload) and "ada@example.com" not in str(payload) for payload in flow.saved_payloads)
    final_message = whatsapp.sent[-1][2]
    assert "https://pay.example/only" in final_message
    assert "internal-id" not in final_message
    assert "pickup-1" not in final_message
    assert all("account" not in str(item).lower() for item in whatsapp.sent)


@pytest.mark.anyio
async def test_out_of_stock_and_cancel_clear_selection():
    merchant = SimpleNamespace(id=uuid4(), business_name="Shop", name="Shop")
    product = SimpleNamespace(name="Sneakers", price=Decimal("5000"), currency="NGN", stock_qty=0, is_published=True, variations=[])
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, product, whatsapp)
    await flow(merchant, _message("product:p1"))
    assert "out of stock" in whatsapp.sent[0][2]
    flow.state.step = "quantity"
    flow.state.payload = {"product_id": "p1"}
    await flow(merchant, _message("cancel"))
    assert flow.state.step == "start"
    assert flow.state.payload == {}


@pytest.mark.anyio
async def test_delivery_checkout_uses_selected_shipping_option(monkeypatch):
    merchant = SimpleNamespace(id=uuid4(), business_name="Shop", name="Shop", pickup_location_id=None, delivery_enabled=True)
    product = SimpleNamespace(bumpa_product_id="p1", name="Sneakers", price=Decimal("5000"), currency="NGN", stock_qty=4, is_published=True, variations=[])
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, product, whatsapp)
    shipping = AsyncMock(return_value=[{"shipping_id": "ship-1", "name": "Standard delivery"}])
    checkout = AsyncMock(return_value=CheckoutResult("internal-id", "order-1", "https://pay.example/only", "PAYREF", Decimal("5500"), "NGN", uuid4()))
    monkeypatch.setattr(bumpa_conversation, "list_shipping_options", shipping)
    monkeypatch.setattr(bumpa_conversation, "start_checkout", checkout)
    monkeypatch.setattr(bumpa_conversation, "has_open_capacity", AsyncMock(return_value=True))
    for body in [
        "product:p1", "1", "pay_online", "Ada Nwosu", "ada@example.com",
        "12 Main Street, Lagos, Lagos",
    ]:
        await flow(merchant, _message(body))
    assert flow.state.step == "shipping"
    shipping.assert_awaited_once()
    assert whatsapp.sent[-1][0] == "list"
    await flow(merchant, _message("shipping:ship-1"))
    assert flow.state.step == "confirm"
    await flow(merchant, _message("confirm"))
    assert checkout.await_args.args[5].shipping_id == "ship-1"
    assert checkout.await_args.args[5].street == "12 Main Street"
    assert checkout.await_args.args[5].city == "Lagos"
    assert checkout.await_args.args[5].country == "Nigeria"
    assert checkout.await_args.args[5].zip is None
    assert not flow._details
    assert all("12 Main Street" not in str(payload) for payload in flow.saved_payloads)


@pytest.mark.anyio
@pytest.mark.parametrize("step", ["variation", "quantity", "payment_method", "full_name", "email", "phone", "fulfilment", "address", "address_state", "street", "city", "state", "country", "zip", "shipping", "confirm"])
async def test_cancel_works_at_every_checkout_step(step):
    merchant = SimpleNamespace(id=uuid4(), business_name="Shop", name="Shop")
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, None, whatsapp)
    flow.state.step = step
    flow.state.payload = {"product_id": "p1", "qty": 1}
    flow._put_detail(merchant.id, "2348012345678", "email", "ada@example.com")
    await flow(merchant, _message("cancel"))
    assert flow.state.step == "start"
    assert flow.state.payload == {}
    assert not flow._details
    assert whatsapp.sent[-1][0] == "list"


@pytest.mark.anyio
async def test_one_ilorin_address_autofills_location_and_registered_postcode(monkeypatch):
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Droid", pickup_location_id=None, delivery_enabled=True)
    flow = ConversationHarness(merchant, None, FakeWhatsApp())
    flow.state.step = "address"
    flow.state.payload = {"product_id": "p1", "qty": 1, "fulfilment": "delivery"}
    flow._put_detail(merchant.id, flow.state.customer_wa_id, "first_name", "Ada")
    flow._put_detail(merchant.id, flow.state.customer_wa_id, "last_name", "Nwosu")
    flow._put_detail(merchant.id, flow.state.customer_wa_id, "email", "ada@example.com")
    flow._put_detail(merchant.id, flow.state.customer_wa_id, "phone", "+2348012345678")
    shipping = AsyncMock(return_value=[{"shipping_id": "ship-1", "name": "Delivery"}])
    monkeypatch.setattr(bumpa_conversation, "list_shipping_options", shipping)
    await flow(merchant, _message("12 Taiwo Road near the pharmacy"))
    fulfilment = shipping.await_args.args[5]
    assert (fulfilment.city, fulfilment.state, fulfilment.country, fulfilment.zip) == ("Ilorin", "Kwara", "Nigeria", "240241")
    assert flow.state.step == "shipping"
    assert all("pharmacy" not in str(payload) for payload in flow.saved_payloads)


@pytest.mark.anyio
async def test_postcode_is_asked_only_after_bumpa_requires_it(monkeypatch):
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Droid")
    flow = ConversationHarness(merchant, None, FakeWhatsApp())
    flow.state.payload = {"product_id": "p1", "qty": 1, "fulfilment": "delivery"}
    for field, value in {"first_name": "Ada", "last_name": "Nwosu", "email": "ada@example.com", "phone": "+2348012345678", "street": "12 Main Street", "city": "Ilorin", "state": "Kwara", "country": "Nigeria"}.items():
        flow._put_detail(merchant.id, flow.state.customer_wa_id, field, value)
    shipping = AsyncMock(side_effect=[CheckoutPostcodeRequired(), [{"shipping_id": "ship-1", "name": "Delivery"}]])
    monkeypatch.setattr(bumpa_conversation, "list_shipping_options", shipping)
    await flow._shipping(merchant, flow.state.customer_wa_id, flow.client, flow.state)
    assert flow.state.step == "zip"
    await flow(merchant, _message("240241"))
    assert flow.state.step == "shipping"
    assert shipping.await_args.args[5].zip == "240241"
