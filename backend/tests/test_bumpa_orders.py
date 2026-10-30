from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest

from app.services.bumpa_orders import _post_order, build_order_payload


def _settings():
    return SimpleNamespace(
        bumpa_base_url="https://api.getbumpa.com/api/commerce/v1",
        bumpa_location_id="loc-1",
        bumpa_secret_key=SimpleNamespace(get_secret_value=lambda: "secret"),
        bumpa_timeout_seconds=10,
    )


def _order(items):
    return SimpleNamespace(
        id=uuid4(),
        vendor_id=uuid4(),
        items=items,
        customer_name="Ada",
        customer_phone="0801",
        currency="NGN",
        payment_reference="pay-1",
        tx_ref="ord-1",
        order_code="ORD-1",
    )


def test_build_order_payload_maps_local_products_and_paid_payment():
    local_id = str(uuid4())
    order = _order([{"product_id": local_id, "qty": 2, "unit_price": "1250.00"}])
    product = SimpleNamespace(bumpa_product_id="bumpa-9", price=Decimal("1250.00"))

    payload = build_order_payload(order, {local_id: product}, location_id="loc-1")

    assert payload["payment_status"] == "paid"
    assert payload["payment_method"] == "bank_transfer"
    assert payload["items"] == [{"product_id": "bumpa-9", "quantity": 2, "price": "1250.00"}]
    assert payload["location_id"] == "loc-1"


def test_build_order_payload_rejects_missing_product_mapping():
    local_id = str(uuid4())
    with pytest.raises(ValueError, match="Missing Bumpa product mapping"):
        build_order_payload(
            _order([{"product_id": local_id, "qty": 1}]),
            {},
            location_id="loc-1",
        )


@pytest.mark.anyio
async def test_bumpa_4xx_is_not_retried():
    calls = 0

    async def handler(_request):
        nonlocal calls
        calls += 1
        return httpx.Response(422, json={"errors": ["invalid"]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(httpx.HTTPStatusError):
            await _post_order({"items": []}, _settings(), client)
    assert calls == 1


@pytest.mark.anyio
async def test_bumpa_5xx_retries_three_times_then_fails(monkeypatch):
    calls = 0

    async def handler(_request):
        nonlocal calls
        calls += 1
        return httpx.Response(503, text="unavailable")

    async def no_sleep(_seconds):
        return None

    monkeypatch.setattr("app.services.bumpa_orders.asyncio.sleep", no_sleep)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(httpx.HTTPStatusError):
            await _post_order({"items": []}, _settings(), client)
    assert calls == 3
