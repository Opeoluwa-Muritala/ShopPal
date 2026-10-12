"""Permissive response envelopes until staging fixtures reveal actual shapes."""

from typing import Any

from pydantic import BaseModel, ConfigDict


class BumpaEnvelope(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: Any | None = None
    data: Any | None = None
    status: Any | None = None
    errors: Any | None = None
    cart_token: Any | None = None
    shipping_options: Any | None = None
    authorization_url: Any | None = None
    reference: Any | None = None
    amount: Any | None = None
    amount_minor: Any | None = None
    currency: Any | None = None
    order_id: Any | None = None
