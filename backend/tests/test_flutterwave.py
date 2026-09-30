from decimal import Decimal

import httpx
import pytest
from pydantic import SecretStr

from app.config import Settings
from app.services.flutterwave import (
    FlutterwaveError,
    verify_bank_account,
    initialize_transaction,
    verify_transaction,
)


def settings() -> Settings:
    return Settings(
        _env_file=None,
        flutterwave_secret_key=SecretStr("FLWSECK_TEST-secret"),
        flutterwave_secret_hash=SecretStr("webhook-secret"),
    )


def test_initialize_flutterwave_checkout(monkeypatch):
    captured = {}

    def post(url, **kwargs):
        captured.update(url=url, **kwargs)
        return httpx.Response(
            200,
            json={
                "status": "success",
                "data": {"link": "https://checkout.flutterwave.com/v3/hosted/pay/test"},
            },
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr("app.services.flutterwave.httpx.post", post)
    result = initialize_transaction(
        order_code="ORD-ABC123",
        amount=Decimal("1250.00"),
        customer_phone="+2348012345678",
        subaccount_id="RS_TEST_SUBACCOUNT",
        settings=settings(),
    )
    assert result["reference"] == "ORD-ABC123"
    assert captured["json"]["amount"] == 125000
    assert captured["json"]["tx_ref"] == "ORD-ABC123"
    assert captured["json"]["subaccounts"][0]["id"] == "RS_TEST_SUBACCOUNT"
    assert captured["json"]["subaccounts"][0]["transaction_charge"] == 0.02
    assert captured["headers"]["Authorization"].startswith("Bearer FLWSECK")


def test_initialize_rejects_untrusted_checkout_url(monkeypatch):
    response = httpx.Response(
        200,
        json={"status": "success", "data": {"link": "https://evil.example/pay"}},
        request=httpx.Request("POST", "https://api.flutterwave.com/v3/payments"),
    )
    monkeypatch.setattr("app.services.flutterwave.httpx.post", lambda *args, **kwargs: response)
    with pytest.raises(FlutterwaveError, match="invalid checkout"):
        initialize_transaction(
            order_code="ORD-ABC123",
            amount=Decimal("10.00"),
            customer_phone="+2348012345678",
            subaccount_id="RS_TEST_SUBACCOUNT",
            settings=settings(),
        )


def test_verify_flutterwave_transaction(monkeypatch):
    def get(url, **kwargs):
        return httpx.Response(
            200,
            json={
                "status": "success",
                "data": {
                    "id": 12345,
                    "tx_ref": "ORD-ABC123",
                    "status": "successful",
                    "amount": 125000,
                    "currency": "NGN",
                },
            },
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr("app.services.flutterwave.httpx.get", get)
    result = verify_transaction("12345", settings())
    assert result["status"] == "successful"


def test_verify_bank_account_returns_provider_name(monkeypatch):
    def post(url, **kwargs):
        return httpx.Response(
            200,
            json={"status": "success", "data": {"account_name": "SHOPPAL VENDOR"}},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr("app.services.flutterwave.httpx.post", post)
    assert verify_bank_account(bank_code="044", account_number="0690000032", settings=settings()) == "SHOPPAL VENDOR"


def test_verify_rejects_non_numeric_transaction_id():
    with pytest.raises(FlutterwaveError, match="transaction ID"):
        verify_transaction("not-an-id", settings())
