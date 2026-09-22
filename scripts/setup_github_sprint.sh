#!/usr/bin/env bash
set -e

echo "=== Setting up GitHub Milestones, Labels, Issues, and Project Board ==="

# Check gh CLI authentication
if ! gh auth status >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) is not authenticated. Run 'gh auth login' first."
  exit 1
fi

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Operating on repository: $REPO"

# 1. Create Labels
echo "--- Creating Labels ---"
declare -A LABELS=(
  ["day-1"]="0075ca:Tasks for Day 1 - Foundation & Setup"
  ["day-2"]="d73a4a:Tasks for Day 2 - Core Commerce"
  ["day-3"]="cfd3d7:Tasks for Day 3 - Polish & Optimization"
  ["day-4"]="a2eeef:Tasks for Day 4 - Demo Readiness"
  ["frontend"]="1d76db:Frontend UI and client portal"
  ["backend"]="5319e7:Backend API, database, and services"
  ["demo-critical"]="e99695:Crucial for live judging demonstration"
  ["blocker"]="b60205:Critical dependency blocking progress"
  ["good-first-task"]="7057ff:Good starter task for sprint onboarding"
)

for label in "${!LABELS[@]}"; do
  IFS=':' read -r color description <<< "${LABELS[$label]}"
  echo "Creating/updating label: $label"
  gh label create "$label" --color "$color" --description "$description" --force || true
done

# 2. Calculate Milestone Due Dates (Relative to Today)
TODAY=$(date +%Y-%m-%d)
DUE_DAY_1=$(date -d "+1 day" +%Y-%m-%d 2>/dev/null || date -v+1d +%Y-%m-%d)
DUE_DAY_2=$(date -d "+2 day" +%Y-%m-%d 2>/dev/null || date -v+2d +%Y-%m-%d)
DUE_DAY_3=$(date -d "+3 day" +%Y-%m-%d 2>/dev/null || date -v+3d +%Y-%m-%d)
DUE_DAY_4=$(date -d "+4 day" +%Y-%m-%d 2>/dev/null || date -v+4d +%Y-%m-%d)

echo "--- Creating Milestones ---"
# Milestone 1
gh api -X POST "repos/$REPO/milestones" \
  -f title="Day 1 — Foundation & Setup" \
  -f description="Establish project foundation: DB schema, Twilio WhatsApp sandbox integration, FastAPI scaffolding, Next.js portal setup, and CI/CD pipelines." \
  -f due_on="${DUE_DAY_1}T23:59:59Z" || true

# Milestone 2
gh api -X POST "repos/$REPO/milestones" \
  -f title="Day 2 — Core Commerce" \
  -f description="Build end-to-end commerce loop: Products & Orders dashboard, Claude LLM conversational engine, WhatsApp order flow, and Paystack payments." \
  -f due_on="${DUE_DAY_2}T23:59:59Z" || true

# Milestone 3
gh api -X POST "repos/$REPO/milestones" \
  -f title="Day 3 — Polish & Optimization" \
  -f description="Refine and stabilize: Paystack webhooks, LLM error handling and retries, UI polishing, mobile responsiveness, and test coverage." \
  -f due_on="${DUE_DAY_3}T23:59:59Z" || true

# Milestone 4
gh api -X POST "repos/$REPO/milestones" \
  -f title="Day 4 — Demo Readiness" \
  -f description="Final verification: End-to-end demo testing, sample catalog seeding, offline backup video recording, and pitch presentation rehearsal." \
  -f due_on="${DUE_DAY_4}T23:59:59Z" || true

echo "--- Creating PRD Execution Plan Issues (Section 8) ---"

create_issue() {
  local title="$1"
  local milestone="$2"
  local labels="$3"
  local body="$4"

  echo "Creating issue: $title"
  gh issue create \
    --title "$title" \
    --milestone "$milestone" \
    --label "$labels" \
    --body "$body"
}

# Day 1 Issues (6 tasks)
create_issue "DB schema design and PostgreSQL connection setup" "Day 1 — Foundation & Setup" "day-1,backend,blocker" "Design SQLAlchemy / SQLModel database schema for Vendors, Products, Orders, and Customers with PostgreSQL connection pooling."
create_issue "Twilio account setup + sandbox active with webhook endpoint" "Day 1 — Foundation & Setup" "day-1,backend,blocker" "Configure Twilio WhatsApp sandbox, create inbound webhook route in FastAPI, and test payload ingestion."
create_issue "Basic FastAPI health check and routing scaffolding" "Day 1 — Foundation & Setup" "day-1,backend,good-first-task" "Establish modular FastAPI routers structure with GET /api/health and error handling middleware."
create_issue "Next.js project setup with Tailwind CSS and layout structure" "Day 1 — Foundation & Setup" "day-1,frontend,good-first-task" "Scaffold Next.js 14 App Router project with Tailwind CSS, base typography, and responsive navbar/sidebar layout."
create_issue "Vendor Signup Page and authentication views" "Day 1 — Foundation & Setup" "day-1,frontend" "Create merchant registration and login interface with email/password form validation."
create_issue "CI/CD pipelines (backend-ci, frontend-ci, deploy) setup" "Day 1 — Foundation & Setup" "day-1,backend,frontend" "Configure GitHub Actions workflows for automated linting, test suites, coverage reports, and deploy hooks."

# Day 2 Issues (6 tasks)
create_issue "Products Dashboard with single item creation form" "Day 2 — Core Commerce" "day-2,frontend" "Build merchant products management view with modal/form for creating items with title, price, description, and stock."
create_issue "CSV catalog upload parser and error reporting modal" "Day 2 — Core Commerce" "day-2,frontend" "Implement drag-and-drop CSV file uploader with client validation and error modal for malformed rows."
create_issue "Orders Dashboard with live status badges" "Day 2 — Core Commerce" "day-2,frontend" "Implement vendor orders table showing order details, customer phone, totals, and colored status badges."
create_issue "LLM integration (Claude + system prompt) for catalog query and Pidgin English" "Day 2 — Core Commerce" "day-2,backend,demo-critical" "Integrate Anthropic Claude API with grounding prompt to answer product inquiries in Nigerian Pidgin and standard English."
create_issue "WhatsApp messaging flow (greeting, catalog search, cart state in Redis)" "Day 2 — Core Commerce" "day-2,backend,demo-critical" "Implement multi-turn conversation handler storing cart state in Redis across customer interactions."
create_issue "Paystack payment link creation and transaction verification endpoints" "Day 2 — Core Commerce" "day-2,backend,demo-critical" "Implement Paystack initialize transaction API call to generate payment links and send to WhatsApp."

# Day 3 Issues (5 tasks)
create_issue "Paystack webhook receiver for real-time payment confirmation notifications" "Day 3 — Polish & Optimization" "day-3,backend" "Create signed webhook endpoint POST /api/webhook/paystack to update order status and trigger confirmation message."
create_issue "Error handling, retries, and rate limiting on LLM and WhatsApp calls" "Day 3 — Polish & Optimization" "day-3,backend" "Add exponential backoff retries and fallback responses for Claude API and Twilio messaging timeouts."
create_issue "Polish Vendor Dashboard UI, stats cards (total revenue, order count)" "Day 3 — Polish & Optimization" "day-3,frontend" "Enhance merchant portal with summary statistics cards (Total Revenue, Active Products, Orders Pending)."
create_issue "Mobile responsiveness optimization across all dashboard screens" "Day 3 — Polish & Optimization" "day-3,frontend,demo-critical" "Audit and optimize layout for mobile screen sizes (tables, forms, navigation)."
create_issue "Backend unit/integration tests and frontend component tests" "Day 3 — Polish & Optimization" "day-3,backend,frontend" "Write Pytest suites for routers/services and Vitest tests for key UI components to maintain test coverage."

# Day 4 Issues (4 tasks)
create_issue "End-to-end user testing (Vendor creates store -> Buyer completes purchase on WhatsApp)" "Day 4 — Demo Readiness" "day-4,demo-critical" "Execute complete end-to-end smoke test validating the entire merchant-to-shopper purchasing cycle."
create_issue "Seed realistic product catalog (fashion, electronics, local groceries)" "Day 4 — Demo Readiness" "day-4,backend,frontend,good-first-task" "Populate database with 10 high-quality Nigerian retail product samples with realistic prices and images."
create_issue "Record 60-second backup demo video in case of network drops" "Day 4 — Demo Readiness" "day-4,demo-critical" "Capture a high-definition 60-second screen recording showing WhatsApp chat and live dashboard update as contingency."
create_issue "Finalize slide deck and rehearse 5-minute pitch" "Day 4 — Demo Readiness" "day-4" "Prepare pitch deck covering problem, solution, TAM, architecture, and live demo rehearsal."

echo "=== GitHub Sprint & Issue Scaffolding Complete ==="
