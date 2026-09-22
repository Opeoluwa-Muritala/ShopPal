# Naija Marketplace (EcomBot)

> **AI-powered conversational WhatsApp e-commerce bot enabling Nigerian merchants to sell effortlessly and shoppers to buy seamlessly via WhatsApp chat.**

---

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| **Backend API** | FastAPI (Python 3.11) | High-performance asynchronous API, webhooks, and core services |
| **Frontend Portal** | Next.js 14, React 18, Tailwind CSS | Vendor onboarding, product catalog management, orders dashboard |
| **Database & Cache** | PostgreSQL 15, Redis | Relational data persistence, conversation state management, session cache |
| **Messaging Gateway** | Twilio WhatsApp Business API / Sandbox | Bi-directional customer chat messaging interface |
| **AI / Intelligence** | Anthropic Claude (via Claude 3.5 Sonnet / Haiku API) | Natural language product discovery, Nigerian Pidgin understanding, cart intent |
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

# Conversational AI (Anthropic Claude)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Paystack Payment Gateway
PAYSTACK_SECRET_KEY=paystack_sk_test_placeholder_key
PAYSTACK_PUBLIC_KEY=paystack_pk_test_placeholder_key
PAYSTACK_WEBHOOK_SECRET=paystack_webhook_secret_hash
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

### 4. Live Demo Monitoring & Diagnostics
- **Health Check Probe**: `GET /api/health`
- **In-Memory Structured Logs**: `GET /api/logs/recent?limit=50`
  Inspect recent incoming webhooks, Claude latency, Twilio deliveries, and DB writes without needing SSH access during the live judging presentation.

---

## Repository Structure

```
naija-marketplace/
├── backend/
│   ├── app/
│   │   ├── db/                 # Database models and session connection
│   │   ├── routers/            # FastAPI route handlers (health, logs, webhooks)
│   │   ├── services/           # LLM agent, Twilio client, Paystack integrations
│   │   ├── logging_conf.py     # Structured JSON logging & recent logs buffer
│   │   └── main.py             # FastAPI entrypoint with error recovery middleware
│   ├── tests/                  # Pytest test suite & conftest fixtures
│   │   ├── load/               # Async load testing scripts (10+ concurrent users)
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
