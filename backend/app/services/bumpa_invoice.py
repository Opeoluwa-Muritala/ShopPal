"""Customer-safe payment confirmation with optional Bumpa invoice link."""

from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.db.models import CheckoutRef, Vendor
from app.integrations.bumpa import mappers
from app.integrations.bumpa.client import BumpaError
from app.integrations.whatsapp.client import WhatsAppClient
from app.logging_conf import logger
from app.services.bumpa_checkout import CheckoutError, _client_for_merchant


class InvoiceNotifier:
    def __init__(self, sessions: async_sessionmaker[AsyncSession], http_client: httpx.AsyncClient, settings: Settings) -> None:
        self.sessions = sessions
        self.http = http_client
        self.settings = settings

    async def __call__(self, merchant: Vendor, ref: CheckoutRef, finalized: dict[str, Any], client: WhatsAppClient) -> None:
        if not ref.customer_wa_id:
            return
        responses: list[dict[str, Any]] = [finalized]
        try:
            bumpa = await _client_for_merchant(merchant.id, self.sessions, self.http, self.settings)
            checkout = await bumpa.get_checkout(ref.bumpa_checkout_id)
            if isinstance(checkout, dict):
                responses.append(checkout)
            order_id = next((value for response in responses if (value := mappers.extract_order_id(response))), None) or ref.bumpa_order_id
            if order_id and bumpa.has_secret_key:
                orders = await bumpa.list_orders(search=order_id, limit=1)
                responses.extend(
                    order for order in mappers.extract_order_rows(orders)
                    if mappers.extract_order_id(order) == order_id
                )
        except (CheckoutError, BumpaError):
            logger.warning("Bumpa invoice lookup deferred", extra={"step": "bumpa_invoice"})
        invoice_url = next((url for response in responses if (url := mappers.extract_invoice_url(response))), None)
        order_number = next((value for response in responses if (value := mappers.extract_order_id(response))), None) or ref.bumpa_order_id or ref.payment_reference or "unavailable"
        amount = next((price for response in responses if (price := mappers.extract_amount(response)) is not None), None)
        currency = next((value for response in responses if (value := mappers.extract_currency(response))), None) or "NGN"
        amount_text = f" {currency} {amount:,.2f}" if amount is not None else ""
        if invoice_url:
            await client.send_text(ref.customer_wa_id, f"Payment confirmed for Bumpa order {order_number}.{amount_text} Bumpa invoice: {invoice_url}")
        else:
            logger.warning("Bumpa invoice URL unavailable", extra={"step": "bumpa_invoice"})
            await client.send_text(ref.customer_wa_id, f"Shoppal payment confirmation: Bumpa order {order_number} paid.{amount_text}")
        if merchant.owner_whatsapp_number:
            first_name = next((value for response in responses if (value := mappers.extract_customer_first_name(response))), None)
            person = f" for {first_name}" if first_name else ""
            template = self.settings.whatsapp_template_owner_paid
            if template:
                await client.send_template(merchant.owner_whatsapp_number, template, "en_US", [order_number, first_name or "Customer"])
            else:
                # TODO(WHATSAPP_OWNER_PAID_TEMPLATE): configure this template
                # before relying on alerts outside the owner's 24-hour window.
                await client.send_text(merchant.owner_whatsapp_number, f"Bumpa order {order_number} paid{person}. Manage it in your Bumpa app.")
