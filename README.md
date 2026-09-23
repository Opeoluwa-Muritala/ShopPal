# Naija Marketplace (EcomBot)

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
| **Payments** | Paystack | Automated payment link generation, checkout, and webhook verification |
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

---

## Deployment Runbook (Render / Railway / Twilio)

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

# Twilio WhatsApp Gateway
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=<twilio-auth-token>
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

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

# Paystack Payment Gateway
PAYSTACK_SECRET_KEY=paystack_sk_test_placeholder_key
PAYSTACK_PUBLIC_KEY=paystack_pk_test_placeholder_key
PAYSTACK_WEBHOOK_SECRET=paystack_webhook_secret_hash

# Authentication & Session Security (Stage 6)
JWT_SECRET=super_secret_jwt_signing_key_at_least_32_chars
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
```

### 3. Twilio Sandbox Webhook Configuration
1. Open the **Twilio Console** and navigate to:
   `Messaging` > `Try it out` > `Send a WhatsApp message` > `Sandbox Settings`.
2. Under **"When a message comes in"**:
   - Select **HTTP POST**.
   - Set the URL to your live backend endpoint:
     `https://<your-service-name>.onrender.com/webhook/whatsapp` (or local ngrok forwarding URL during staging).
3. Under **"Status callback URL"**:
   - Set to: `https://<your-service-name>.onrender.com/webhook/status`.
4. Click **Save**.

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
│   │   ├── services/           # Auth & JWT service, LLM agent, Twilio client, Paystack integrations
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
