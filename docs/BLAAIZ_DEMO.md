# Blaaiz payment demo

This branch adds a development-environment Blaaiz card-collection flow without changing the existing Flutterwave or Bumpa paths.

## Setup

1. Create a separate development account at `business-dev.blaaiz.com` and enable API Services.
2. Create OAuth credentials with `collection:create`, `transaction:read`, and `wallet:read` scopes.
3. Create an NGN wallet and a verified Blaaiz customer. The backend resolves the single active NGN wallet through the Wallet API when `BLAAIZ_WALLET_ID` is empty. Card collections are unavailable until Blaaiz enables them for the business.
4. Copy the Blaaiz values from `backend/.env.example` into the backend environment. Use `BLAAIZ_ENV=development` for `https://api-dev.blaaiz.com`.
5. In the Blaaiz dashboard, set the collection webhook URL to `https://<backend>/webhooks/blaaiz` and copy its dedicated signing secret into `BLAAIZ_WEBHOOK_SIGNING_SECRET`.

## Demo request

Call `POST /payments/blaaiz/collections` with the normal dashboard API key and owner/staff bearer token. The order must belong to that account's vendor and still be awaiting payment.

```json
{
  "order_code": "ORDER123",
  "customer_id": "verified-blaaiz-customer-id",
  "card_holder_name": "Demo Customer",
  "card_number": "<development test card>",
  "expiry": "12/30",
  "cvc": "<test cvc>",
  "phone": "+2348012345678"
}
```

The API returns Blaaiz's `transaction_id` and HTTPS `authorization_url` for 3DS when one is required. Card number and CVC are forwarded once and are not stored or logged. Use only Blaaiz-provided test cards in development.

The signed webhook verifies its five-minute timestamp window, then independently fetches the Blaaiz transaction and checks status, merchant reference, currency, and exact order amount before marking the order paid. The browser redirect is never treated as proof of payment.
