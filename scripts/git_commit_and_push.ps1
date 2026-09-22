# Script to initialize, stage by action, commit with standard Conventional Commits, and push

Write-Host "=== Git Staged Commits & Push Pipeline ===" -ForegroundColor Cyan

# Ensure git repository is initialized
if (-not (Test-Path ".git")) {
    Write-Host "Initializing git repository with main branch..." -ForegroundColor Yellow
    git init -b main
}

# Check if user email / name is set, provide fallbacks if unset
$gitName = git config user.name
$gitEmail = git config user.email
if (-not $gitName) {
    git config user.name "Naija Marketplace Team"
}
if (-not $gitEmail) {
    git config user.email "team@naijamarketplace.local"
}

# Commit Action 1: Core Repo Configuration & Root Documentation
Write-Host "`n[Action 1/6] Staging core repository configuration..." -ForegroundColor Yellow
git add .gitignore LICENSE README.md SECURITY.md CONTRIBUTING.md .pre-commit-config.yaml
git commit -m "chore: initialize project configuration, contributing standards, and security policy"

# Commit Action 2: Comprehensive Architecture & Product Documentation
Write-Host "`n[Action 2/6] Staging project documentation..." -ForegroundColor Yellow
git add docs/PRD.md docs/ARCHITECTURE.md docs/DECISIONS.md docs/DEMO_CHECKLIST.md docs/RUNBOOK.md docs/SPRINT_PLAN.md
git commit -m "docs: add product requirements, architecture spec, ADRs, runbook, and demo checklist"

# Commit Action 3: GitHub Standards, CI/CD Workflows, and Templates
Write-Host "`n[Action 3/6] Staging GitHub CI/CD workflows and community templates..." -ForegroundColor Yellow
git add .github/
git commit -m "ci: add GitHub Actions pipelines for backend, frontend, deploy, and PR templates"

# Commit Action 4: Backend Scaffolding & Testing Setup
Write-Host "`n[Action 4/6] Staging backend scaffolding and health test..." -ForegroundColor Yellow
git add backend/
git commit -m "feat(backend): scaffold FastAPI structure, /api/health endpoint stub, and pytest suite"

# Commit Action 5: Frontend Scaffolding & Vitest Setup
Write-Host "`n[Action 5/6] Staging frontend scaffolding and layout test..." -ForegroundColor Yellow
git add frontend/
git commit -m "feat(frontend): scaffold Next.js layout, package dependencies, and Vitest test suite"

# Commit Action 6: Sprint Automation Scripts
Write-Host "`n[Action 6/6] Staging sprint automation scripts..." -ForegroundColor Yellow
git add scripts/
git commit -m "chore(sprint): add GitHub CLI automation scripts and sprint setup tooling"

Write-Host "`n=== Git Log of Created Staged Commits ===" -ForegroundColor Green
git log --oneline -n 6

# Push logic
Write-Host "`n=== Checking Remote and Pushing ===" -ForegroundColor Cyan
$remotes = git remote
if ($remotes -contains "origin") {
    Write-Host "Remote 'origin' found. Pushing to origin main..." -ForegroundColor Green
    git push -u origin main
} else {
    Write-Host "No remote 'origin' configured." -ForegroundColor Yellow
    # Check if gh CLI has a repository linked
    try {
        $ghRepo = gh repo view --json nameWithOwner -q .nameWithOwner 2>$null
        if ($ghRepo) {
            Write-Host "Connecting git remote origin to https://github.com/$ghRepo.git..." -ForegroundColor Green
            git remote add origin "https://github.com/$ghRepo.git"
            git push -u origin main
        } else {
            Write-Host "Notice: No remote origin detected. To push, run: git remote add origin <repo-url> && git push -u origin main" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Notice: Remote origin not set. Add a remote with 'git remote add origin <URL>' then push." -ForegroundColor Yellow
    }
}
Write-Host "`n=== Done ===" -ForegroundColor Green
