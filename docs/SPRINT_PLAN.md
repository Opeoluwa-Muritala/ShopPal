# Sprint & Issue Structure — Naija Marketplace (EcomBot)

This document contains the complete sprint plan, milestones, issue breakdown, and project board configuration derived from Section 8 of [docs/PRD.md](docs/PRD.md).

---

## 1. GitHub Milestones

| Milestone Title | Target Due Date (Relative) | Description / Checkpoint Text |
| --- | --- | --- |
| **Day 1 — Foundation & Setup** | Today + 1 Day | Establish project foundation: DB schema, Twilio WhatsApp sandbox integration, FastAPI scaffolding, Next.js portal setup, and CI/CD pipelines. |
| **Day 2 — Core Commerce** | Today + 2 Days | Build end-to-end commerce loop: Products & Orders dashboard, Gemma LLM conversational engine, WhatsApp order flow, and Paystack payments. |
| **Day 3 — Polish & Optimization** | Today + 3 Days | Refine and stabilize: Paystack webhooks, LLM error handling and retries, UI polishing, mobile responsiveness, and test coverage. |
| **Day 4 — Demo Readiness** | Today + 4 Days | Final verification: End-to-end demo testing, sample catalog seeding, offline backup video recording, and pitch presentation rehearsal. |

---

## 2. GitHub Labels

| Label Name | Hex Color | Description |
| --- | --- | --- |
| `day-1` | `#0075ca` | Tasks for Day 1 - Foundation & Setup |
| `day-2` | `#d73a4a` | Tasks for Day 2 - Core Commerce |
| `day-3` | `#cfd3d7` | Tasks for Day 3 - Polish & Optimization |
| `day-4` | `#a2eeef` | Tasks for Day 4 - Demo Readiness |
| `frontend` | `#1d76db` | Frontend UI and client portal |
| `backend` | `#5319e7` | Backend API, database, and services |
| `demo-critical` | `#e99695` | Crucial for live judging demonstration |
| `blocker` | `#b60205` | Critical dependency blocking progress |
| `good-first-task` | `#7057ff` | Good starter task for sprint onboarding |

---

## 3. GitHub Project Board Configuration

- **Project Title**: `Naija Marketplace Sprint Board`
- **View Type**: Kanban Board
- **Columns**:
  1. `Backlog` (All 21 issues initialized here, unassigned for team members to claim)
  2. `In Progress`
  3. `Review`
  4. `Done`

---

## 4. Issue Breakdown by Milestone (21 Issues Total)

### Milestone: Day 1 — Foundation & Setup (6 Issues)
1. **DB schema design and PostgreSQL connection setup**
   - **Labels**: `day-1`, `backend`, `blocker`
   - **Body**: Design SQLAlchemy / SQLModel database schema for Vendors, Products, Orders, and Customers with PostgreSQL connection pooling.
   - **Assignee**: *Unassigned (claimable)*
2. **Twilio account setup + sandbox active with webhook endpoint**
   - **Labels**: `day-1`, `backend`, `blocker`
   - **Body**: Configure Twilio WhatsApp sandbox, create inbound webhook route in FastAPI, and test payload ingestion.
   - **Assignee**: *Unassigned (claimable)*
3. **Basic FastAPI health check and routing scaffolding**
   - **Labels**: `day-1`, `backend`, `good-first-task`
   - **Body**: Establish modular FastAPI routers structure with GET /api/health and error handling middleware.
   - **Assignee**: *Unassigned (claimable)*
4. **Next.js project setup with Tailwind CSS and layout structure**
   - **Labels**: `day-1`, `frontend`, `good-first-task`
   - **Body**: Scaffold Next.js 14 App Router project with Tailwind CSS, base typography, and responsive navbar/sidebar layout.
   - **Assignee**: *Unassigned (claimable)*
5. **Vendor Signup Page and authentication views**
   - **Labels**: `day-1`, `frontend`
   - **Body**: Create merchant registration and login interface with email/password form validation.
   - **Assignee**: *Unassigned (claimable)*
6. **CI/CD pipelines (backend-ci, frontend-ci, deploy) setup**
   - **Labels**: `day-1`, `backend`, `frontend`
   - **Body**: Configure GitHub Actions workflows for automated linting, test suites, coverage reports, and deploy hooks.
   - **Assignee**: *Unassigned (claimable)*

### Milestone: Day 2 — Core Commerce (6 Issues)
7. **Products Dashboard with single item creation form**
   - **Labels**: `day-2`, `frontend`
   - **Body**: Build merchant products management view with modal/form for creating items with title, price, description, and stock.
   - **Assignee**: *Unassigned (claimable)*
8. **CSV catalog upload parser and error reporting modal**
   - **Labels**: `day-2`, `frontend`
   - **Body**: Implement drag-and-drop CSV file uploader with client validation and error modal for malformed rows.
   - **Assignee**: *Unassigned (claimable)*
9. **Orders Dashboard with live status badges**
   - **Labels**: `day-2`, `frontend`
   - **Body**: Implement vendor orders table showing order details, customer phone, totals, and colored status badges.
   - **Assignee**: *Unassigned (claimable)*
10. **LLM integration (Gemma + system prompt) for catalog query and Pidgin English**
    - **Labels**: `day-2`, `backend`, `demo-critical`
    - **Body**: Integrate Google Gemma API with grounding prompt to answer product inquiries in Nigerian Pidgin and standard English.
    - **Assignee**: *Unassigned (claimable)*
11. **WhatsApp messaging flow (greeting, catalog search, cart state in Redis)**
    - **Labels**: `day-2`, `backend`, `demo-critical`
    - **Body**: Implement multi-turn conversation handler storing cart state in Redis across customer interactions.
    - **Assignee**: *Unassigned (claimable)*
12. **Paystack payment link creation and transaction verification endpoints**
    - **Labels**: `day-2`, `backend`, `demo-critical`
    - **Body**: Implement Paystack initialize transaction API call to generate payment links and send to WhatsApp.
    - **Assignee**: *Unassigned (claimable)*

### Milestone: Day 3 — Polish & Optimization (5 Issues)
13. **Paystack webhook receiver for real-time payment confirmation notifications**
    - **Labels**: `day-3`, `backend`
    - **Body**: Create signed webhook endpoint POST /api/webhook/paystack to update order status and trigger confirmation message.
    - **Assignee**: *Unassigned (claimable)*
14. **Error handling, retries, and rate limiting on LLM and WhatsApp calls**
    - **Labels**: `day-3`, `backend`
    - **Body**: Add exponential backoff retries and fallback responses for Gemma API and Twilio messaging timeouts.
    - **Assignee**: *Unassigned (claimable)*
15. **Polish Vendor Dashboard UI, stats cards (total revenue, order count)**
    - **Labels**: `day-3`, `frontend`
    - **Body**: Enhance merchant portal with summary statistics cards (Total Revenue, Active Products, Orders Pending).
    - **Assignee**: *Unassigned (claimable)*
16. **Mobile responsiveness optimization across all dashboard screens**
    - **Labels**: `day-3`, `frontend`, `demo-critical`
    - **Body**: Audit and optimize layout for mobile screen sizes (tables, forms, navigation).
    - **Assignee**: *Unassigned (claimable)*
17. **Backend unit/integration tests and frontend component tests**
    - **Labels**: `day-3`, `backend`, `frontend`
    - **Body**: Write Pytest suites for routers/services and Vitest tests for key UI components to maintain test coverage.
    - **Assignee**: *Unassigned (claimable)*

### Milestone: Day 4 — Demo Readiness (4 Issues)
18. **End-to-end user testing (Vendor creates store -> Buyer completes purchase on WhatsApp)**
    - **Labels**: `day-4`, `demo-critical`
    - **Body**: Execute complete end-to-end smoke test validating the entire merchant-to-shopper purchasing cycle.
    - **Assignee**: *Unassigned (claimable)*
19. **Seed realistic product catalog (fashion, electronics, local groceries)**
    - **Labels**: `day-4`, `backend`, `frontend`, `good-first-task`
    - **Body**: Populate database with 10 high-quality Nigerian retail product samples with realistic prices and images.
    - **Assignee**: *Unassigned (claimable)*
20. **Record 60-second backup demo video in case of network drops**
    - **Labels**: `day-4`, `demo-critical`
    - **Body**: Capture a high-definition 60-second screen recording showing WhatsApp chat and live dashboard update as contingency.
    - **Assignee**: *Unassigned (claimable)*
21. **Finalize slide deck and rehearse 5-minute pitch**
    - **Labels**: `day-4`
    - **Body**: Prepare pitch deck covering problem, solution, TAM, architecture, and live demo rehearsal.
    - **Assignee**: *Unassigned (claimable)*

---

## 5. Execution Scripts
Run either script from the repository root once connected to GitHub:
- **Bash / Linux / macOS**: `./scripts/setup_github_sprint.sh`
- **PowerShell (Windows)**: `.\scripts\setup_github_sprint.ps1`
