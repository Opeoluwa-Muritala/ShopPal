# Setup GitHub Milestones, Labels, Issues, and Board for Naija Marketplace
Write-Host "=== Setting up GitHub Milestones, Labels, Issues, and Project Board ===" -ForegroundColor Cyan

# Verify gh CLI
try {
    gh auth status
} catch {
    Write-Error "GitHub CLI (gh) is not authenticated. Please run 'gh auth login' first."
    exit 1
}

$repo = (gh repo view --json nameWithOwner -q .nameWithOwner)
Write-Host "Target repository: $repo" -ForegroundColor Green

# 1. Labels
$labels = @{
    "day-1" = @{ color = "0075ca"; desc = "Tasks for Day 1 - Foundation & Setup" }
    "day-2" = @{ color = "d73a4a"; desc = "Tasks for Day 2 - Core Commerce" }
    "day-3" = @{ color = "cfd3d7"; desc = "Tasks for Day 3 - Polish & Optimization" }
    "day-4" = @{ color = "a2eeef"; desc = "Tasks for Day 4 - Demo Readiness" }
    "frontend" = @{ color = "1d76db"; desc = "Frontend UI and client portal" }
    "backend" = @{ color = "5319e7"; desc = "Backend API, database, and services" }
    "demo-critical" = @{ color = "e99695"; desc = "Crucial for live judging demonstration" }
    "blocker" = @{ color = "b60205"; desc = "Critical dependency blocking progress" }
    "good-first-task" = @{ color = "7057ff"; desc = "Good starter task for sprint onboarding" }
}

Write-Host "`n--- Creating Labels ---" -ForegroundColor Yellow
foreach ($name in $labels.Keys) {
    $info = $labels[$name]
    Write-Host "Creating/updating label: $name"
    gh label create $name --color $info.color --description $info.desc --force 2>$null
}

# 2. Milestones with relative dates
$today = Get-Date
$due1 = ($today.AddDays(1)).ToString("yyyy-MM-ddTHH:mm:ssZ")
$due2 = ($today.AddDays(2)).ToString("yyyy-MM-ddTHH:mm:ssZ")
$due3 = ($today.AddDays(3)).ToString("yyyy-MM-ddTHH:mm:ssZ")
$due4 = ($today.AddDays(4)).ToString("yyyy-MM-ddTHH:mm:ssZ")

Write-Host "`n--- Creating Milestones ---" -ForegroundColor Yellow
gh api -X POST "repos/$repo/milestones" -f title="Day 1 — Foundation & Setup" -f description="Establish project foundation: DB schema, Twilio WhatsApp sandbox integration, FastAPI scaffolding, Next.js portal setup, and CI/CD pipelines." -f due_on="$due1" 2>$null
gh api -X POST "repos/$repo/milestones" -f title="Day 2 — Core Commerce" -f description="Build end-to-end commerce loop: Products & Orders dashboard, Claude LLM conversational engine, WhatsApp order flow, and Paystack payments." -f due_on="$due2" 2>$null
gh api -X POST "repos/$repo/milestones" -f title="Day 3 — Polish & Optimization" -f description="Refine and stabilize: Paystack webhooks, LLM error handling and retries, UI polishing, mobile responsiveness, and test coverage." -f due_on="$due3" 2>$null
gh api -X POST "repos/$repo/milestones" -f title="Day 4 — Demo Readiness" -f description="Final verification: End-to-end demo testing, sample catalog seeding, offline backup video recording, and pitch presentation rehearsal." -f due_on="$due4" 2>$null

# 3. Create Issues from PRD Section 8
Write-Host "`n--- Creating Issues ---" -ForegroundColor Yellow

function New-SprintIssue {
    param(
        [string]$Title,
        [string]$Milestone,
        [string]$Labels,
        [string]$Body
    )
    Write-Host "Creating Issue: $Title"
    gh issue create --title "$Title" --milestone "$Milestone" --label "$Labels" --body "$Body"
}

# Day 1 Issues (6)
New-SprintIssue -Title "DB schema design and PostgreSQL connection setup" -Milestone "Day 1 — Foundation & Setup" -Labels "day-1,backend,blocker" -Body "Design SQLAlchemy / SQLModel database schema for Vendors, Products, Orders, and Customers with PostgreSQL connection pooling."
New-SprintIssue -Title "Twilio account setup + sandbox active with webhook endpoint" -Milestone "Day 1 — Foundation & Setup" -Labels "day-1,backend,blocker" -Body "Configure Twilio WhatsApp sandbox, create inbound webhook route in FastAPI, and test payload ingestion."
New-SprintIssue -Title "Basic FastAPI health check and routing scaffolding" -Milestone "Day 1 — Foundation & Setup" -Labels "day-1,backend,good-first-task" -Body "Establish modular FastAPI routers structure with GET /api/health and error handling middleware."
New-SprintIssue -Title "Next.js project setup with Tailwind CSS and layout structure" -Milestone "Day 1 — Foundation & Setup" -Labels "day-1,frontend,good-first-task" -Body "Scaffold Next.js 14 App Router project with Tailwind CSS, base typography, and responsive navbar/sidebar layout."
New-SprintIssue -Title "Vendor Signup Page and authentication views" -Milestone "Day 1 — Foundation & Setup" -Labels "day-1,frontend" -Body "Create merchant registration and login interface with email/password form validation."
New-SprintIssue -Title "CI/CD pipelines (backend-ci, frontend-ci, deploy) setup" -Milestone "Day 1 — Foundation & Setup" -Labels "day-1,backend,frontend" -Body "Configure GitHub Actions workflows for automated linting, test suites, coverage reports, and deploy hooks."

# Day 2 Issues (6)
New-SprintIssue -Title "Products Dashboard with single item creation form" -Milestone "Day 2 — Core Commerce" -Labels "day-2,frontend" -Body "Build merchant products management view with modal/form for creating items with title, price, description, and stock."
New-SprintIssue -Title "CSV catalog upload parser and error reporting modal" -Milestone "Day 2 — Core Commerce" -Labels "day-2,frontend" -Body "Implement drag-and-drop CSV file uploader with client validation and error modal for malformed rows."
New-SprintIssue -Title "Orders Dashboard with live status badges" -Milestone "Day 2 — Core Commerce" -Labels "day-2,frontend" -Body "Implement vendor orders table showing order details, customer phone, totals, and colored status badges."
New-SprintIssue -Title "LLM integration (Claude + system prompt) for catalog query and Pidgin English" -Milestone "Day 2 — Core Commerce" -Labels "day-2,backend,demo-critical" -Body "Integrate Anthropic Claude API with grounding prompt to answer product inquiries in Nigerian Pidgin and standard English."
New-SprintIssue -Title "WhatsApp messaging flow (greeting, catalog search, cart state in Redis)" -Milestone "Day 2 — Core Commerce" -Labels "day-2,backend,demo-critical" -Body "Implement multi-turn conversation handler storing cart state in Redis across customer interactions."
New-SprintIssue -Title "Paystack payment link creation and transaction verification endpoints" -Milestone "Day 2 — Core Commerce" -Labels "day-2,backend,demo-critical" -Body "Implement Paystack initialize transaction API call to generate payment links and send to WhatsApp."

# Day 3 Issues (5)
New-SprintIssue -Title "Paystack webhook receiver for real-time payment confirmation notifications" -Milestone "Day 3 — Polish & Optimization" -Labels "day-3,backend" -Body "Create signed webhook endpoint POST /api/webhook/paystack to update order status and trigger confirmation message."
New-SprintIssue -Title "Error handling, retries, and rate limiting on LLM and WhatsApp calls" -Milestone "Day 3 — Polish & Optimization" -Labels "day-3,backend" -Body "Add exponential backoff retries and fallback responses for Claude API and Twilio messaging timeouts."
New-SprintIssue -Title "Polish Vendor Dashboard UI, stats cards (total revenue, order count)" -Milestone "Day 3 — Polish & Optimization" -Labels "day-3,frontend" -Body "Enhance merchant portal with summary statistics cards (Total Revenue, Active Products, Orders Pending)."
New-SprintIssue -Title "Mobile responsiveness optimization across all dashboard screens" -Milestone "Day 3 — Polish & Optimization" -Labels "day-3,frontend,demo-critical" -Body "Audit and optimize layout for mobile screen sizes (tables, forms, navigation)."
New-SprintIssue -Title "Backend unit/integration tests and frontend component tests" -Milestone "Day 3 — Polish & Optimization" -Labels "day-3,backend,frontend" -Body "Write Pytest suites for routers/services and Vitest tests for key UI components to maintain test coverage."

# Day 4 Issues (4)
New-SprintIssue -Title "End-to-end user testing (Vendor creates store -> Buyer completes purchase on WhatsApp)" -Milestone "Day 4 — Demo Readiness" -Labels "day-4,demo-critical" -Body "Execute complete end-to-end smoke test validating the entire merchant-to-shopper purchasing cycle."
New-SprintIssue -Title "Seed realistic product catalog (fashion, electronics, local groceries)" -Milestone "Day 4 — Demo Readiness" -Labels "day-4,backend,frontend,good-first-task" -Body "Populate database with 10 high-quality Nigerian retail product samples with realistic prices and images."
New-SprintIssue -Title "Record 60-second backup demo video in case of network drops" -Milestone "Day 4 — Demo Readiness" -Labels "day-4,demo-critical" -Body "Capture a high-definition 60-second screen recording showing WhatsApp chat and live dashboard update as contingency."
New-SprintIssue -Title "Finalize slide deck and rehearse 5-minute pitch" -Milestone "Day 4 — Demo Readiness" -Labels "day-4" -Body "Prepare pitch deck covering problem, solution, TAM, architecture, and live demo rehearsal."

Write-Host "`n=== All Milestones and Issues Created Successfully ===" -ForegroundColor Green
