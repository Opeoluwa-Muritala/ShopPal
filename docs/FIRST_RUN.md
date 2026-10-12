# Bumpa staging first run

The integration is built without a Bumpa key. Nothing in the build or test suite calls Bumpa or Meta. Use your **fake Bumpa store** and staging keys for this run. Do not commit `backend/.env` or anything in `backend/tests/fixtures/bumpa/real/`.

From the repository root in PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
.\.venv\Scripts\python.exe -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Put that generated key in `KEY_ENCRYPTION_SECRET` in `backend/.env`. Set `DATABASE_URL` to your **Neon pooled** PostgreSQL connection string with `sslmode=require`. Set `BUMPA_BASE_URL=https://api.bumpa.xyz`, `BUMPA_PUBLIC_KEY`, `BUMPA_SECRET_KEY`, and `BUMPA_LOCATION_ID` for the probe. These three probe credentials are not used by merchant onboarding; `/connect` stores per-merchant encrypted credentials. Set `WHATSAPP_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET` before starting the API.

Run the migration and read-only probe:

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe scripts\bumpa_probe.py
```

The read-only mode lists products, reads one product, and lists orders. Review the `found`/`UNKNOWN` mapper table and the redacted JSON under `tests/fixtures/bumpa/real/`. Update only `app/integrations/bumpa/mappers.py` for response field mismatches. `UNKNOWN` for an optional invoice or shipping field can be legitimate; unknown product IDs, prices, cart IDs, checkout IDs, or payment URLs are blockers.

Run the **explicit** test checkout after you have verified that Paystack test payments settle to the fake merchant's account. Replace every placeholder with fake-store test details:

```powershell
..\.venv\Scripts\python.exe scripts\bumpa_probe.py --checkout --product-id "<product-id>" --quantity 1 --first-name "Test" --last-name "Buyer" --email "<test-email>" --phone "<test-phone>" --street "<test-street>" --city "<test-city>" --state "<test-state>" --country "Nigeria" --zip "<test-postcode>"
```

This creates a cart, adds the item, asks Bumpa for shipping, creates a checkout, calculates totals, and creates the payment intent. It **stops before finalize**. Open the returned authorization URL and make one **Paystack test-mode** payment. Copy the checkout ID printed by the probe, then run:

```powershell
..\.venv\Scripts\python.exe scripts\bumpa_probe.py --after-payment "<checkout-id>"
..\.venv\Scripts\python.exe -m pytest tests\test_real_fixtures.py -o addopts= -p no:cacheprovider --basetemp=..\.pytest-tmp\real-fixtures
..\.venv\Scripts\python.exe -m pytest tests -o addopts= -p no:cacheprovider --basetemp=..\.pytest-tmp\first-run
..\.venv\Scripts\python.exe -m ruff check .
..\.venv\Scripts\python.exe -m mypy --follow-imports=silent --ignore-missing-imports app\integrations\bumpa app\services\bumpa_checkout.py app\services\bumpa_sync.py app\services\bumpa_payments.py app\services\bumpa_transfers.py app\services\bumpa_invoice.py scripts\bumpa_probe.py
```

The after-payment mode fetches the checkout, tries empty-body finalize, then searches orders for an invoice or receipt link. If Bumpa says payment is not yet confirmed, wait and retry the same command. Reconcile any mapper `UNKNOWN` output against the captured responses and rerun the tests. Do not move real captures into `handwritten/` or commit them.

Start the API in one terminal. In a **second** PowerShell terminal, sign in as the fake store owner and connect the merchant. Replace the placeholders; do not put a Bumpa key into the frontend source code:

```powershell
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
Set-Location backend
$headers = @{ Authorization = "Bearer <owner-jwt>" }
$body = @{ public_key = "<public-key>"; secret_key = "<secret-key>"; location_id = "<location-id>" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/merchants/<merchant-id>/bumpa/connect" -Headers $headers -ContentType "application/json" -Body $body
$whatsapp = @{ phone_number_id = "<meta-phone-number-id>"; owner_whatsapp_number = "+234<owner-number>"; access_token = "<merchant-meta-token>" } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri "http://127.0.0.1:8000/merchants/<merchant-id>/whatsapp" -Headers $headers -ContentType "application/json" -Body $whatsapp
$payout = @{ bank_name = "<bank-name>"; account_name = "<owner-account-name>"; account_number = "<10-digit-NUBAN>" } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri "http://127.0.0.1:8000/merchants/<merchant-id>/payout-details" -Headers $headers -ContentType "application/json" -Body $payout
$fulfilment = @{ pickup_location_id = "<bumpa-pickup-location-id>"; delivery_enabled = $true } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri "http://127.0.0.1:8000/merchants/<merchant-id>/fulfilment" -Headers $headers -ContentType "application/json" -Body $fulfilment
```

Configure the merchant's Meta WhatsApp `phone_number_id`, the owner's E.164 WhatsApp number, and the merchant's Meta access token through `PUT /merchants/<merchant-id>/whatsapp`. Configure bank name, account name, and ten-digit NUBAN through `PUT /merchants/<merchant-id>/payout-details`. Configure `pickup_location_id` and/or delivery through `PUT /merchants/<merchant-id>/fulfilment`. The owner JWT is required for all three. Register `https://<your-public-host>/webhooks/whatsapp` with Meta using the configured verify token and app secret. In Meta, approve templates for the owner transfer alert (including the warning that a screenshot is never proof), customer transfer expiry, and owner transfer expiry. Set their names in `WHATSAPP_TEMPLATE_OWNER_TRANSFER_ALERT`, `WHATSAPP_TEMPLATE_TRANSFER_EXPIRY`, and `WHATSAPP_TEMPLATE_OWNER_TRANSFER_EXPIRY`. The owner paid alert also needs a template if it may be sent outside Meta's customer-service window; confirm its approval status before production.

Run one full WhatsApp online purchase: browse the synced catalog, select a product and variation, choose pickup or delivery, provide details, follow the pay-only URL, pay in test mode, and check that the customer receives a Bumpa invoice URL if available or a message explicitly labelled **Shoppal payment confirmation**. Check the order and fulfillment in the owner's Bumpa app. Then run one full transfer purchase: choose **Pay by transfer**, verify the bank details appear only then, send `I've paid` or an image, verify the owner alert, and reply `CONFIRM <ref>` or `REJECT <ref>` from the registered owner number. Confirm the owner records the transfer sale in Bumpa; Shoppal does not create a transfer order or reduce Bumpa stock.

The probe refuses any base URL other than `https://api.bumpa.xyz` unless you explicitly pass `--i-know-this-is-production`. Never use that override during the fake-store run.
