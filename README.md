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

## Repository Structure

```
naija-marketplace/
├── backend/
│   ├── app/
│   │   ├── db/                 # Database models and session connection
│   │   ├── routers/            # FastAPI route handlers (webhooks, auth, products, orders)
│   │   ├── services/           # LLM agent, Twilio client, Paystack integrations
│   │   └── main.py             # FastAPI entrypoint
│   ├── tests/                  # Pytest test suite & conftest fixtures
│   ├── requirements.txt        # Backend dependencies
│   ├── .env.example            # Backend environment variables template
│   ├── pyproject.toml          # Ruff and Pytest coverage configuration
│   └── Dockerfile              # Containerization definition
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
