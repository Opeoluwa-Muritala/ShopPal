# Naija Marketplace (EcomBot)

## Bumpa-backed ShopPal merchants

Existing merchants keep the legacy catalog and checkout flow. A merchant connected to Bumpa has `catalog_provider='bumpa'`: Bumpa owns products, stock, orders, payments, invoices, and fulfillment. ShopPal caches published products in Neon for fast WhatsApp browsing, checks a selected product live before quoting it, and sends customers through Bumpa's pay-only authorization URL. Bumpa API response shapes remain unverified until the [staging first run](docs/FIRST_RUN.md).

Set `DATABASE_URL` to a Neon **pooled** PostgreSQL URL with `sslmode=require`. Set `KEY_ENCRYPTION_SECRET` to a Fernet key; the API fails startup if it is absent or invalid. `BUMPA_BASE_URL` defaults to `https://api.bumpa.xyz` for development and should be set explicitly to `https://api.getbumpa.com` only after staging verification. `BUMPA_TIMEOUT_SECONDS` defaults to 10 and `BUMPA_SYNC_INTERVAL_MINUTES` to 10. `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, and `WHATSAPP_API_BASE` configure Meta Cloud API intake. `BUMPA_PUBLIC_KEY`, `BUMPA_SECRET_KEY`, and `BUMPA_LOCATION_ID` in `.env` are used **only by the optional probe script**; the merchant's keys are submitted through the owner-authenticated connect endpoint and encrypted in Neon. Never put these keys or the merchant's WhatsApp token in the frontend.

The owner connects with `POST /merchants/{id}/bumpa/connect` (public key, optional secret key, location ID), configures the WhatsApp number and owner alert number with `PUT /merchants/{id}/whatsapp`, payout details with `PUT /merchants/{id}/payout-details`, and pickup/delivery with `PUT /merchants/{id}/fulfilment`. A complete catalog sweep runs every ten minutes by default, with `POST /merchants/{id}/bumpa/sync` for an owner-triggered refresh. Failed sweeps cannot hide unseen products; live product reads refresh the cache before checkout. Bumpa keys, raw payloads, and location IDs are never sent to customers. Bumpa merchants cannot write the legacy product catalog or manage orders through legacy order routes.

In WhatsApp, the customer browses or searches cached products, selects a variation and quantity, then chooses **Pay online** or **Pay by transfer**. Online checkout asks for contact and pickup/delivery details one question at a time, creates the cart and exact checkout through Bumpa, and sends only the authorization URL with a short summary. A scheduler polls Bumpa for payment and finalizes it. If an invoice/receipt URL is present in Bumpa's responses, the customer receives it; otherwise the message is labelled **Shoppal payment confirmation**. Transfer instructions appear only after that option is selected. A customer message or screenshot marks proof for owner review but never confirms payment. Only the registered owner number can `CONFIRM <ref>` or `REJECT <ref>`, and the owner records the sale in the Bumpa app. ShopPal does not mark Bumpa orders shipped.

ShopPal stores only encrypted merchant credentials, the raw **product** response for remapping, cached product fields, thin checkout IDs/payment references, and short-lived pending transfers. It does not keep Bumpa order histories, customer profiles, addresses, or line items. Personal details collected during the online questions stay in process memory for up to one hour and go directly to Bumpa; a multi-worker deployment needs the documented encrypted shared-state TODO. Conversation state expires after 24 hours of inactivity, webhook IDs after 48 hours, and customer WhatsApp/media IDs on completed or expired references after seven days. Pending transfers expire after 24 hours. Real probe captures are locally ignored by Git.

### Known unknowns to verify on staging

1. Where merchants obtain their Bumpa public and secret API keys.
2. Which Paystack account receives checkout payments; it must be the merchant's, not ShopPal's.
3. Whether an order created at payment intent appears as pending or abandoned in the owner's Bumpa app before payment, and whether it clutters the order list.
4. Whether Bumpa orders can be labelled with a source or channel such as “Shoppal”.
5. Whether empty-body finalize works without ShopPal verifying Paystack independently.
6. Whether Bumpa sends its own customer receipt/invoice and whether any response contains an invoice URL.
7. Bumpa's rate limits.
8. The `shipping_id` versus `shipping_method_id` naming mismatch in the docs.
9. Actual response fields for product ID, price, stock, images, variations, checkout ID, order ID, and invoice; use the probe's mapper report.
10. Which WhatsApp templates are required and approved for owner alerts, customer confirmation, and transfer reminders/expiry.
11. Whether Bumpa has an API to mark a transfer order paid; this integration assumes none.

---

The sections below describe the existing **legacy** merchant demo and deployment flow.

> **AI-powered conversational WhatsApp e-commerce bot enabling Nigerian merchants to sell effortlessly and shoppers to buy seamlessly via WhatsApp chat.**

---

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| **Backend API** | FastAPI (Python 3.11) | High-performance asynchronous API, webhooks, and core services |
| **Frontend Portal** | Next.js 14, React 18, Tailwind CSS | Vendor onboarding, product catalog management, orders dashboard |
| **Database & Cache** | PostgreSQL 15, Redis | Relational data persistence, conversation state management, session cache |
| **Messaging Gateway** | Twilio WhatsApp and Meta Cloud API | Bi-directional customer chat messaging interface |
| **AI / Intelligence** | Google Gemma (via Gemma 3 generateContent API) | Natural language product discovery, Nigerian Pidgin understanding, cart intent |
| **Payments** | Flutterwave (Paystack legacy support) | Automated checkout, split settlement, transaction verification, and signed webhooks |
| **Testing** | Pytest, Vitest, React Testing Library | Backend unit/integration tests and frontend UI component tests |
| **CI / CD** | GitHub Actions | Automated linting, test suites, coverage checks, and deployment webhooks |
| **Hosting** | Render / Railway (Backend), Vercel (Frontend) | Cloud application hosting and continuous deployment |

---

## Local Development Prerequisites

Ensure you have the following installed on your development machine (versions specified):
- **Python 3.11**
- **Node.js 20 (LTS)**
- **PostgreSQL 15+**
- **Redis 7+**
- **ngrok** (for tunneling incoming WhatsApp webhooks to localhost)

## Demo Login and Usage

The seeded ShopPal demo merchant account is intended for judging and local demo use only:

| Field | Value |
| --- | --- |
| Login page | `/login` on the deployed frontend, or `http://localhost:3000/login` locally |
| Email | `demo.perfumes@shoppal.ng` |
| Password | `DemoShopPal123!` |
| WhatsApp demo | [Open ShopPal chat](https://wa.me/2349110501393?text=Hi) |

If the account is missing, run `cd backend` followed by
`..\.venv\Scripts\python.exe scripts\seed_demo_vendor.py`. The seeder refreshes the
demo merchant, login, perfume catalog, stock, and product images.

### Suggested demo flow

1. Sign in with the credentials above to view the dashboard, products, orders, analytics, and settings.
2. Open the WhatsApp demo link and send `Hi`. This also opens Meta's 24-hour customer-service window for free-form replies and images.
3. Send `What do you sell?` to browse the live catalog.
4. Send `Can I get images?`, then reply with a listed product name. A direct request such as `Send me an image of Lagos Bloom` also works.
5. Add an item with a quantity, view the cart, and request checkout. Supply a delivery address when prompted.
6. Use the returned payment controls to test the Flutterwave bank-transfer flow. A verified payment produces a receipt image, explanatory caption, and prefilled WhatsApp action links.

WhatsApp `wa.me` links prefill a message; the customer must still tap **Send**. Outside
the 24-hour window, Meta permits only approved message templates, so start a fresh demo
by sending `Hi` from the customer phone.

### Conversation context

Yes—the model receives context from the conversation, including both earlier customer
messages and ShopPal's responses. The database retains the latest 40 conversation
entries, while each model call receives up to 20 customer messages and
20 assistant responses in chronological order. Greetings during an ongoing conversation
use the AI with this context rather than a fresh-conversation template. The current message, queued customer
messages, and durable tool results for the active reply are supplied separately. This
allows follow-ups such as `that one`, a quantity-only answer, or a product name selected
from the preceding image list without sending the whole conversation to the model.

Bumpa conversations use Gemma to interpret natural product selections and payment
choices and to phrase questions naturally. Both customer and assistant messages are
held in a bounded 40-entry memory window with a one-hour idle expiry; collected
personal details, bank instructions and payment links are excluded from that context.
No Bumpa conversation history is added to Neon. The backend validates every product
selection and payment transition; Bumpa remains authoritative for prices and stock.
If Gemma is unavailable, the guided checkout still works. Read receipts and typing
indicators are sent before preparing replies; their failure does not suppress replies.

### WhatsApp bank-transfer checkout

New orders use Flutterwave dynamic virtual accounts and stay entirely in WhatsApp:

1. Copy `backend/.env.example` to `backend/.env` and set `FLW_CLIENT_ID`, `FLW_CLIENT_SECRET`, `FLW_ENV=sandbox`, `FLW_WEBHOOK_SECRET_HASH`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `DATABASE_URL`, and `ORDER_EXPIRY_MINUTES`.
2. Run `cd backend; ..\\.venv\\Scripts\\Activate.ps1; alembic upgrade head; uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`.
3. Configure Meta's webhook URL as `https://<ngrok-host>/webhooks/whatsapp` and Flutterwave's webhook URL as `https://<ngrok-host>/webhooks/flutterwave`.
4. Start the frontend separately with `cd frontend; npm install; npm run dev`; no Flutterwave or WhatsApp credentials belong in the frontend.

Sandbox checklist: create a cart, tap `Pay`, confirm the returned dynamic account has the exact order amount and expiry, send a mocked/sandbox transfer, verify the signed `charge.completed` callback, retry the same callback, tap `I've paid` before and after settlement, test wrong-amount review, and wait for expiry.

---

## Deployment Runbook (Render / Railway / Meta WhatsApp)

### 1. Backend Web Service Creation (Render / Railway)
- **Environment**: Docker or Python 3.11 Runtime
- **Root Directory**: `backend`
- **Build Command**: `pip install -r requirements.txt` (or Docker automatic build from `backend/Dockerfile`)
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`
- **Healthcheck Path**: `/api/health` (HTTP 200)
- **Auto-Deploy**: Enabled via Git push to `main` gated by CI workflows.

### 2. Environment Variables Configuration
Set the following environment variables in your hosting platform dashboard:
```bash
# Application Runtime
ENVIRONMENT=production
PORT=8000
DEBUG=false
SECRET_KEY=<generated-32-char-random-key>

# Database & Cache
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname>?sslmode=require
REDIS_URL=rediss://<user>:<password>@<host>:<port>

# Meta WhatsApp Cloud API
WHATSAPP_VERIFY_TOKEN=<random-webhook-verification-token>
WHATSAPP_APP_SECRET=<meta-app-secret>
WHATSAPP_ACCESS_TOKEN=<permanent-system-user-token>
WHATSAPP_PHONE_NUMBER_ID=<meta-phone-number-id>

# Conversational AI (Google Gemma)
GEMMA_API_KEY=your-google-ai-api-key
GEMMA_MODEL=gemma-3-27b-it
# Optional fallback; Google is primary whenever GEMMA_API_KEY is set.
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=google/gemma-3-27b-it
META_REPLY_WORKER_ENABLED=true
META_REPLY_WORKER_CONCURRENCY=4
META_REPLY_WORKER_POLL_SECONDS=1

# Flutterwave v4 dynamic virtual accounts (platform-managed)
FLW_CLIENT_ID=your-flutterwave-client-id
FLW_CLIENT_SECRET=your-flutterwave-client-secret
FLW_ENV=sandbox
FLW_WEBHOOK_SECRET_HASH=your-flutterwave-webhook-secret-hash
FLW_ENCRYPTION_KEY=optional-v3-encryption-key
ORDER_EXPIRY_MINUTES=30

# Legacy v3 credentials, only for the isolated fallback adapter
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-X
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-X
FLUTTERWAVE_SECRET_HASH=your-flutterwave-webhook-secret-hash
FLUTTERWAVE_REDIRECT_URL=https://your-frontend.example.com/payment/callback
FLUTTERWAVE_PLATFORM_FEE_PERCENT=0.02

# Legacy Paystack support for existing orders only
PAYSTACK_SECRET_KEY=paystack_sk_test_placeholder_key
PAYSTACK_PUBLIC_KEY=paystack_pk_test_placeholder_key
PAYSTACK_WEBHOOK_SECRET=paystack_webhook_secret_hash

# Authentication & Session Security (Stage 6)
JWT_SECRET=super_secret_jwt_signing_key_at_least_32_chars
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
```

### 3. Meta and Flutterwave webhook configuration
1. Set Meta's callback URL to `https://<your-service-name>.onrender.com/webhooks/whatsapp` and configure the verify token and app secret.
2. Set Flutterwave's webhook URL to `https://<your-service-name>.onrender.com/webhooks/flutterwave` and configure the v4 webhook secret hash.
3. Use HTTPS in production and keep all provider credentials in the backend environment only.

### 4. Meta WhatsApp Cloud API Configuration

1. Set the callback to `https://shoppal.onrender.com/webhooks/whatsapp`.
2. Use the same verification token in Meta and `WHATSAPP_VERIFY_TOKEN`.
3. Subscribe the WhatsApp Business Account to the `messages` field.
4. Set the four Meta environment variables above in Render.
5. Set the vendor's `bot_number` to Meta's display phone number so incoming
   customers are routed to the correct shop.

Meta POST callbacks are signature-verified and acknowledged after PostgreSQL
commits the event and durable reply job. Apply migration `0004` and set
`META_REPLY_WORKER_ENABLED=true` to process new text messages through Gemma and
Meta's Graph API. Failed work resumes from saved tool results and replies.
See [reply recovery and rollout](docs/REPLY_RECOVERY.md) for operational details.

Gemma selects thinking automatically in code. It selects `minimal` for
simple greetings, catalog browsing, and bare cart requests, and `high` for
ambiguous selections, unknown phrasing, and decisions involving prior context.
Environment variables cannot override this policy. The benchmark explicitly
selects fixed levels for comparison. Gemma 4 has no native `medium` level.
Thinking selection never changes stock, price, payment,
or tool authorization checks. The Bumpa conversation remains a separate state
machine; this policy applies to the Gemma customer assistant.

To compare response times with synthetic shopping context and no tool execution,
run `..\.venv\Scripts\python.exe scripts\benchmark_gemma_thinking.py --repeats 2`
from `backend`. This opt-in command calls Google using `GEMMA_API_KEY`; it never
calls Bumpa or WhatsApp. Results report latency and expected action matches,
which are limited checks rather than a general model accuracy score.
Both benchmark levels have the same 2,048-token ceiling and 60-second timeout.
In the application, `minimal` keeps a 256-token allowance while `high` has
2,048 tokens for reasoning and the final response. Customer replies stay short.

- API documentation: `https://shoppal.onrender.com/docs`
- Privacy policy: `https://shoppal.onrender.com/privacy`
- Setup guide: [`docs/META_WHATSAPP_SETUP.md`](docs/META_WHATSAPP_SETUP.md)

### 5. Live Demo Monitoring & Diagnostics
- **Health Check Probe**: `GET /api/health`
- **In-Memory Structured Logs**: `GET /api/logs/recent?limit=50`
  Inspect recent incoming webhooks, Gemma latency, Twilio deliveries, and DB writes without needing SSH access during the live judging presentation.

---

## Repository Structure

```
naija-marketplace/
├── backend/
│   ├── alembic/                # Alembic database schema migrations
│   ├── app/
│   │   ├── db/                 # Database models and session connection
│   │   ├── routers/            # FastAPI route handlers (auth, accounts, vendors, orders, products, webhooks)
│   │   ├── services/           # Auth & JWT service, LLM agent, Twilio client, payment integrations
│   │   ├── logging_conf.py     # Structured JSON logging & recent logs buffer
│   │   └── main.py             # FastAPI entrypoint with error recovery middleware
│   ├── tests/                  # Pytest test suite & conftest fixtures
│   │   ├── security/           # Security & abuse tests (IDOR, rate-limiting, injection)
│   │   ├── load/               # Async load testing scripts (10+ concurrent users)
│   │   ├── test_auth.py        # Comprehensive Stage 6 auth & account structure tests
│   │   ├── test_error_handling.py # Structured logging & webhook error recovery tests
│   │   ├── test_load_smoke.py  # CI-runnable lightweight load test smoke check
│   │   ├── test_config.py      # Configuration tests
│   │   └── test_health.py      # Liveness health check tests
│   ├── requirements.txt        # Backend dependencies
│   ├── .env.example            # Backend environment variables template
│   ├── pyproject.toml          # Ruff and Pytest coverage configuration
│   └── Dockerfile              # Containerization definition with healthcheck probe
├── frontend/
│   ├── app/                    # Next.js App Router (vendor onboarding & dashboards)
│   ├── components/             # Reusable UI elements
│   ├── lib/                    # Client-side helpers and API client
│   ├── tests/                  # Vitest UI tests
│   ├── package.json            # Node.js dependencies & scripts
│   ├── vitest.config.ts        # Vitest & React Testing Library config
│   └── .env.example            # Frontend environment variables template
├── docs/
│   ├── PRD.md                  # Complete Product Requirements Document
│   ├── ARCHITECTURE.md         # System diagram and component details
│   ├── DECISIONS.md            # Architecture Decision Records (ADRs)
│   ├── DEMO_CHECKLIST.md       # Final hackathon demo readiness checklist
│   └── RUNBOOK.md              # Critical path risks and mitigation procedures
├── .github/
│   ├── workflows/
│   │   ├── backend-ci.yml      # Backend linting, testing, and coverage check
│   │   ├── frontend-ci.yml     # Frontend linting, type-check, test, and build
│   │   └── deploy.yml          # Production deployment pipeline
│   ├── PULL_REQUEST_TEMPLATE.md# Standardized pull request format
│   ├── ISSUE_TEMPLATE/         # GitHub issue templates
│   └── CODEOWNERS              # Component ownership mapping
├── scripts/                    # Sprint automation and GitHub CLI setup scripts
├── .gitignore
├── CONTRIBUTING.md             # Branch, commit, and PR standards
├── SECURITY.md                 # Security guidelines and secret rotation policies
├── LICENSE                     # MIT License
└── README.md
```

---

## Branch Protection & Merging Policy

Configure `main` branch protection in GitHub repository Settings > Branches:
- **Mandatory CI Status Checks**: require the exact checks `backend-ci` and `frontend-ci`, with branches up to date before merging.
- **Code Review**: At least **one peer review approval** is required.
- **No Direct Pushes**: Direct commits to `main` are restricted. All changes must originate from feature, fix, or chore branches via pull request.

Required status checks are a GitHub repository setting. Workflow YAML and this
README cannot enforce merge protection on their own. Both CI workflows run on
every PR to `main` so a path filter cannot leave a required check pending.

Backend CI runs the entire `backend/tests/` suite and fails on test failures or
coverage below the floor in `backend/pyproject.toml`. The initial enforced floor
is **100%**, measured from the currently merged health-only application (one test,
five executable statements), rounded down to the nearest 5%. This measurement
does not imply that Stages 1–3 are implemented or tested. Future PRs cannot lower
the floor; see [Test Failures](CONTRIBUTING.md#5-test-failures).

---

## Team & Ownership

This project employs strict code ownership across domains. For reviewer assignments and component responsibility, refer to [.github/CODEOWNERS](.github/CODEOWNERS).
- **Backend Services & Webhooks**: Lead by `@backend-dev-placeholder`
- **Vendor Portal & UI**: Lead by `@frontend-dev-placeholder`
- **Architecture & DevOps**: Overseen by `@tech-lead-placeholder`
