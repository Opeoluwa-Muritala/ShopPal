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

    async def send_image(self, to, image_url, caption=""):
        self.sent.append(("image", to, image_url, caption))

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
        self._remote_baskets = SimpleNamespace(sync=AsyncMock(return_value="remote-cart"), forget=Mock())
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
        items = self._basket_for(_merchant.id, wa_id)
        await self._set_state(self.state, "start", {"basket_count": len(items)} if items else {})
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
    assert flow.state.step == "more_items" and flow.state.payload["qty"] == 2
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
        ("hi", "start"), ("product:p1", "more_items"), ("1", "more_items"), ("no", "payment_method"),
        ("pay_online", "full_name"), ("Ada Nwosu", "email"),
        ("ada@example.com", "fulfilment"),
        ("pickup", "confirm"), ("confirm", "awaiting_payment"),
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
async def test_browsing_and_checkout_retry_reuse_email_without_persisting_it(monkeypatch):
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Droid", pickup_location_id="pickup-1", delivery_enabled=False)
    product = SimpleNamespace(bumpa_product_id="p1", name="Bag", price=Decimal("5000"), currency="NGN", stock_qty=4, is_published=True, variations=[])
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, product, whatsapp)
    checkout = AsyncMock(side_effect=[bumpa_conversation.CheckoutError("Temporary failure"),
        CheckoutResult("checkout-1", "order-1", "https://pay.example/only", "PAYREF", Decimal("10000"), "NGN", uuid4())])
    monkeypatch.setattr(bumpa_conversation, "start_checkout", checkout)
    monkeypatch.setattr(bumpa_conversation, "has_open_capacity", AsyncMock(return_value=True))
    for body in ["product:p1", "no", "pay_online", "Ada Nwosu", "ada@example.com", "menu", "product:p1", "no", "pay_online"]:
        await flow(merchant, _message(body))
    assert flow.state.step == "confirm"
    await flow(merchant, _message("confirm"))
    assert flow.state.step == "confirm"
    await flow(merchant, _message("confirm"))
    assert flow.state.step == "awaiting_payment"
    assert checkout.await_count == 2
    assert all(call.args[4].email == "ada@example.com" for call in checkout.await_args_list)
    assert sum("What email" in row[2] for row in whatsapp.sent) == 1
    assert sum("What is your full name" in row[2] for row in whatsapp.sent) == 1
    assert all("ada@example.com" not in str(payload) for payload in flow.saved_payloads)
    assert not flow._details


@pytest.mark.anyio
async def test_existing_email_is_reused_after_missing_name_is_collected():
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Droid", pickup_location_id="pickup-1", delivery_enabled=False)
    product = SimpleNamespace(bumpa_product_id="p1", name="Bag", price=Decimal("5000"), currency="NGN", stock_qty=4, is_published=True, variations=[])
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, product, whatsapp)
    flow._put_detail(merchant.id, flow.state.customer_wa_id, "email", "ada@example.com")
    for body in ["product:p1", "no", "pay_online", "Ada Nwosu"]:
        await flow(merchant, _message(body))
    assert flow.state.step == "confirm"
    assert not any("What email" in row[2] for row in whatsapp.sent)


@pytest.mark.anyio
@pytest.mark.parametrize("configured", [True, False])
async def test_online_outage_hands_off_to_owner_without_losing_basket(monkeypatch, configured):
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Droid", pickup_location_id="pickup-1", delivery_enabled=False,
        payout_bank_name="Test Bank" if configured else None, payout_account_name="Test Owner" if configured else None,
        payout_account_number="1234567890" if configured else None, owner_whatsapp_number="+2348011111111")
    product = SimpleNamespace(bumpa_product_id="p1", name="Bag", price=Decimal("5000"), currency="NGN", stock_qty=4, is_published=True, variations=[])
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, product, whatsapp)
    monkeypatch.setattr(bumpa_conversation, "start_checkout", AsyncMock(side_effect=bumpa_conversation.CheckoutUnavailable("Unavailable")))
    monkeypatch.setattr(bumpa_conversation, "has_open_capacity", AsyncMock(return_value=True))
    for body in ["product:p1", "product:p2", "no", "pay_online", "Ada Nwosu", "ada@example.com"]:
        await flow(merchant, _message(body))
    assert all("1234567890" not in str(row) for row in whatsapp.sent)
    await flow(merchant, _message("confirm"))
    assert flow.state.step == "confirm"
    assert len(flow._basket_for(merchant.id, flow.state.customer_wa_id)) == 2
    assert flow._details_for(merchant.id, flow.state.customer_wa_id)["email"] == "ada@example.com"
    flow._transfers.create.assert_not_awaited()
    reply = whatsapp.sent[-1][2]
    if configured:
        assert "1234567890" in reply and "confirm the full amount" in reply
        assert "record your sale in Bumpa" in reply
    else:
        assert "hasn't set up bank transfer" in reply
    assert "awaiting_payment" not in flow.state.step
    assert all("1234567890" not in str(payload) for payload in flow.saved_payloads)


@pytest.mark.anyio
async def test_shipping_outage_sends_owner_account_but_validation_does_not(monkeypatch):
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Droid", pickup_location_id=None, delivery_enabled=True,
        payout_bank_name="Test Bank", payout_account_name="Test Owner", payout_account_number="1234567890", owner_whatsapp_number=None)
    product = SimpleNamespace(bumpa_product_id="p1", name="Bag", price=Decimal("5000"), currency="NGN", stock_qty=4, is_published=True, variations=[])
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, product, whatsapp)
    flow.state.payload = {"product_id": "p1", "qty": 1, "fulfilment": "delivery"}
    for field, value in {"first_name": "Ada", "last_name": "Nwosu", "email": "ada@example.com", "street": "12 Main Street", "city": "Ilorin", "state": "Kwara", "country": "Nigeria", "zip": "240101"}.items():
        flow._put_detail(merchant.id, flow.state.customer_wa_id, field, value)
    monkeypatch.setattr(bumpa_conversation, "list_shipping_options", AsyncMock(side_effect=bumpa_conversation.CheckoutError("Invalid address")))
    await flow._shipping(merchant, flow.state.customer_wa_id, whatsapp, flow.state)
    assert "1234567890" not in whatsapp.sent[-1][2]
    monkeypatch.setattr(bumpa_conversation, "list_shipping_options", AsyncMock(side_effect=bumpa_conversation.CheckoutUnavailable("Unavailable")))
    await flow._shipping(merchant, flow.state.customer_wa_id, whatsapp, flow.state)
    assert "1234567890" in whatsapp.sent[-1][2]


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
        "product:p1", "1", "no", "pay_online", "Ada Nwosu", "ada@example.com",
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
@pytest.mark.parametrize("step", ["variation", "quantity", "more_items", "payment_method", "full_name", "email", "phone", "fulfilment", "address", "address_state", "street", "city", "state", "country", "zip", "shipping", "confirm"])
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


@pytest.mark.anyio
async def test_menu_shows_full_names_and_maps_numbers_without_mutating_inventory():
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Old demo")
    name = "Droid Demo Perfumes Long Distinct Product Name"
    product = SimpleNamespace(bumpa_product_id="p1", name=name, price=Decimal("5000"),
                              currency="NGN", stock_qty=4, is_published=True, variations=[],
                              image_urls=["https://images.example/perfume.jpg"])
    duplicate = SimpleNamespace(**{**vars(product), "bumpa_product_id": "p2"})
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, product, whatsapp)
    session = FakeSession()
    session.scalars = AsyncMock(return_value=SimpleNamespace(all=lambda: [product, duplicate]))
    flow._sessions = lambda: session
    await BumpaConversation._menu(flow, merchant, flow.state.customer_wa_id, whatsapp)
    assert len(whatsapp.sent) == 1 and whatsapp.sent[0][0] == "list"
    assert "Droid" in whatsapp.sent[0][2]
    assert name in whatsapp.sent[0][3][0][2]
    assert "https://" not in str(whatsapp.sent)
    assert flow.state.payload["menu_ids"] == ["p1"]
    assert len(whatsapp.sent[-1][3]) == 1
    assert "name" not in flow.state.payload
    flow._product = AsyncMock(return_value=(product, False))
    await flow(merchant, _message("1"))
    flow._product.assert_awaited_once_with(merchant, "p1")
    assert flow.state.step == "more_items"
    assert whatsapp.sent[-2] == ("image", flow.state.customer_wa_id, "https://images.example/perfume.jpg", name)
    assert whatsapp.sent[-1][0] == "buttons"
    assert duplicate.bumpa_product_id == "p2"


@pytest.mark.anyio
async def test_natural_checkout_continues_from_number_selection_to_payment_link(monkeypatch):
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Droid", pickup_location_id="pickup-1", delivery_enabled=False)
    product = SimpleNamespace(name="Bag", price=Decimal("5000"), currency="NGN", stock_qty=4, is_published=True, variations=[])
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, product, whatsapp)
    flow.state.payload = {"menu_ids": ["p1"]}
    checkout = AsyncMock(return_value=CheckoutResult("internal-id", "order-1", "https://pay.example/only", "PAYREF", Decimal("5000"), "NGN", uuid4()))
    monkeypatch.setattr(bumpa_conversation, "start_checkout", checkout)
    monkeypatch.setattr(bumpa_conversation, "has_open_capacity", AsyncMock(return_value=True))
    for body, expected in [("1", "more_items"), ("checkout", "payment_method"),
                           ("pay online", "full_name"), ("Ada", "full_name"),
                           ("Ada Nwosu", "email"), ("ada@example.com", "confirm"), ("confirm", "awaiting_payment")]:
        await flow(merchant, _message(body))
        assert flow.state.step == expected
    assert checkout.await_args.args[3] == 1
    assert "https://pay.example/only" in whatsapp.sent[-1][2]
    assert not flow._details


@pytest.mark.anyio
async def test_checkout_recovers_after_process_loses_personal_details():
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Droid")
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, None, whatsapp)
    flow.state.step = "confirm"
    flow.state.payload = {"product_id": "p1", "qty": 2, "fulfilment": "delivery", "shipping_id": "old"}
    await flow(merchant, _message("confirm"))
    assert flow.state.step == "full_name"
    assert flow.state.payload == {"product_id": "p1", "qty": 2}
    assert "expired" in whatsapp.sent[-1][2]


@pytest.mark.anyio
async def test_number_outside_current_menu_does_not_select_a_product():
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Droid")
    flow = ConversationHarness(merchant, None, FakeWhatsApp())
    flow.state.payload = {"menu_ids": ["p1"]}
    flow._product = AsyncMock()
    await flow(merchant, _message("2"))
    flow._product.assert_not_awaited()
    assert flow.state.step == "start"


@pytest.mark.anyio
async def test_exact_product_name_selects_one_without_gemma():
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Droid")
    product = SimpleNamespace(bumpa_product_id="p1", name="Rose Perfume", price=Decimal("5000"),
                              currency="NGN", stock_qty=4, is_published=True, variations=[], image_urls=[])
    flow = ConversationHarness(merchant, product, FakeWhatsApp())
    session = FakeSession()
    session.scalars = AsyncMock(return_value=SimpleNamespace(all=lambda: [product]))
    flow._sessions = lambda: session
    flow._product = AsyncMock(return_value=(product, False))
    await flow(merchant, _message("rose perfume"))
    flow._product.assert_awaited_once_with(merchant, "p1")
    assert flow.state.step == "more_items"
    assert flow.state.payload == {"product_id": "p1", "qty": 1, "basket_count": 1}


@pytest.mark.anyio
async def test_greeting_uses_shop_name_without_forcing_a_menu():
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Old demo")
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, None, whatsapp)
    await flow(merchant, _message("hi"))
    assert whatsapp.sent == [("text", flow.state.customer_wa_id, "Hi! Welcome to Droid. What are you looking for today?")]


@pytest.mark.anyio
async def test_real_picker_reply_selects_quantity_one_and_sends_native_photo():
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Droid")
    product = SimpleNamespace(name="Rose Perfume", price=Decimal("5000"), currency="NGN",
                              stock_qty=4, is_published=True, variations=[], image_urls=["https://images.example/rose.jpg"])
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, product, whatsapp)
    await flow(merchant, {"from": flow.state.customer_wa_id, "type": "interactive",
                          "interactive": {"type": "list_reply", "list_reply": {"id": "product:p1", "title": "Rose Perfume"}}})
    assert flow.state.step == "more_items"
    assert flow.state.payload == {"product_id": "p1", "qty": 1, "basket_count": 1}
    assert [message[0] for message in whatsapp.sent] == ["image", "buttons"]
    assert "https://" not in whatsapp.sent[-1][2]
    await flow(merchant, _message("3"))
    assert flow.state.payload["qty"] == 3
    assert sum(message[0] == "image" for message in whatsapp.sent) == 1


@pytest.mark.anyio
async def test_photo_failure_does_not_stop_picker_checkout():
    import httpx

    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Droid")
    product = SimpleNamespace(name="Bag", price=Decimal("5000"), currency="NGN", stock_qty=4,
                              is_published=True, variations=[], image_urls=["https://images.example/bag.jpg"])
    whatsapp = FakeWhatsApp()
    whatsapp.send_image = AsyncMock(side_effect=httpx.ConnectError("unavailable"))
    flow = ConversationHarness(merchant, product, whatsapp)
    await flow(merchant, _message("product:p1"))
    assert flow.state.step == "more_items"
    assert whatsapp.sent[-1][0] == "buttons"


@pytest.mark.anyio
async def test_multiple_products_stay_in_basket_until_confirmed_payment(monkeypatch):
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Droid", pickup_location_id="pickup-1", delivery_enabled=False)
    products = {identifier: SimpleNamespace(name=name, price=Decimal("5000"), currency="NGN", stock_qty=10,
                                          is_published=True, variations=[], image_urls=[]) for identifier, name in [("p1", "Bag"), ("p2", "Perfume")]}
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, None, whatsapp)
    flow._product = AsyncMock(side_effect=lambda _merchant, identifier: (products[identifier], False))
    result = CheckoutResult("checkout-1", "order-1", "https://pay.example/only", "PAYREF", Decimal("10000"), "NGN", uuid4())
    checkout = AsyncMock(return_value=result)
    monkeypatch.setattr(bumpa_conversation, "start_checkout", checkout)
    monkeypatch.setattr(bumpa_conversation, "has_open_capacity", AsyncMock(return_value=True))
    for body in ["product:p1", "more_yes", "product:p2", "more_no", "pay_online", "Ada Nwosu", "ada@example.com", "confirm"]:
        await flow(merchant, _message(body))
    assert [(item.product_id, item.qty) for item in checkout.await_args.kwargs["items"]] == [("p1", 1), ("p2", 1)]
    assert len(flow._basket_for(merchant.id, flow.state.customer_wa_id)) == 2
    assert flow.state.step == "awaiting_payment" and not flow._details
    await flow(merchant, _message("cart"))
    assert "Bag" in whatsapp.sent[-1][2] and "Perfume" in whatsapp.sent[-1][2]
    assert flow.state.step == "awaiting_payment"
    await flow._basket_paid(SimpleNamespace(id=uuid4(), merchant_id=merchant.id, customer_wa_id=flow.state.customer_wa_id))
    assert len(flow._basket_for(merchant.id, flow.state.customer_wa_id)) == 2
    await flow._basket_paid(SimpleNamespace(id=result.local_ref_id, merchant_id=merchant.id, customer_wa_id=flow.state.customer_wa_id))
    assert flow.state.step == "start" and not flow._basket_for(merchant.id, flow.state.customer_wa_id)
    assert all("items" not in payload and "Bag" not in str(payload) and "ada@example.com" not in str(payload) for payload in flow.saved_payloads)


@pytest.mark.anyio
async def test_cart_quantity_reduction_and_zero_remove_without_resending_photo():
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Droid")
    product = SimpleNamespace(name="Bag", price=Decimal("5000"), currency="NGN", stock_qty=10,
                              is_published=True, variations=[], image_urls=["https://images.example/bag.jpg"])
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, product, whatsapp)
    await flow(merchant, _message("product:p1"))
    await flow(merchant, _message("5"))
    await flow(merchant, _message("cart"))
    await flow(merchant, _message("cart:0"))
    assert flow.state.step == "edit_quantity"
    await flow(merchant, _message("2"))
    assert flow._basket_for(merchant.id, flow.state.customer_wa_id)[0].qty == 2
    assert sum(row[0] == "image" for row in whatsapp.sent) == 1
    await flow(merchant, _message("0"))
    assert flow.state.step == "start" and not flow._basket_for(merchant.id, flow.state.customer_wa_id)


@pytest.mark.anyio
async def test_order_command_routes_to_customer_scoped_bumpa_lookup():
    merchant = SimpleNamespace(id=uuid4(), business_name="Droid", name="Droid")
    flow = ConversationHarness(merchant, None, FakeWhatsApp())
    flow._payments = SimpleNamespace(customer_orders=AsyncMock(return_value="Your Bumpa order is paid."))
    await flow(merchant, _message("my orders"))
    flow._payments.customer_orders.assert_awaited_once_with(merchant, flow.state.customer_wa_id)


@pytest.mark.anyio
async def test_droid_demo_photo_fallback_matches_selected_item_and_tenant():
    from app.services.demo_catalog_images import (
        DEMO_IMAGES,
        DROID_DEMO_MERCHANT,
        demo_image_url,
    )

    name, url = next(iter(DEMO_IMAGES.items()))
    assert demo_image_url(uuid4(), name) is None
    assert demo_image_url(DROID_DEMO_MERCHANT, "Unknown product") is None
    merchant = SimpleNamespace(id=DROID_DEMO_MERCHANT, business_name="Droid", name="Droid")
    product = SimpleNamespace(name=name, price=Decimal("5000"), currency="NGN", stock_qty=10,
                              is_published=True, variations=[], image_urls=["https://images.example/blocked.jpg"])
    whatsapp = FakeWhatsApp()
    flow = ConversationHarness(merchant, product, whatsapp)
    await flow(merchant, _message("product:p1"))
    assert whatsapp.sent[0] == ("image", flow.state.customer_wa_id, url, name)
    await flow(merchant, _message("2"))
    assert sum(message[0] == "image" for message in whatsapp.sent) == 1
