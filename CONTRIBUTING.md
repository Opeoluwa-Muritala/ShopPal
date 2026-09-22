# Contributing Guidelines — Naija Marketplace (EcomBot)

Welcome to the **Naija Marketplace** hackathon repository! To maintain speed, code quality, and collaboration throughout our sprint cycle, all contributors must adhere to these standards.

---

## 1. Branch Naming Conventions

Always branch off `main` using descriptive names that follow our prefixes:
- `feature/<short-description>`: New functionality or user-facing task (e.g. `feature/vendor-signup`, `feature/twilio-webhook`).
- `fix/<short-description>`: Bug fixes or patches (e.g. `fix/csv-parser-error`, `fix/mobile-table-overflow`).
- `chore/<short-description>`: Tooling, dependency, or configuration changes (e.g. `chore/vitest-setup`, `chore/dockerfile-update`).
- `docs/<short-description>`: Documentation additions or updates (e.g. `docs/architecture-update`).

*Example:* `feature/day-2-orders-dashboard`

---

## 2. Commit Message Conventions (Conventional Commits)

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description in imperative mood>
```

### Allowed Types:
- `feat:` A new feature or endpoint
- `fix:` A bug fix
- `chore:` Maintenance, dependency, or configuration updates
- `docs:` Documentation changes only
- `test:` Adding or updating tests
- `refactor:` Code refactoring with no functional change

### Examples:
- `feat(backend): add twilio webhook router for whatsapp incoming messages`
- `fix(frontend): handle empty orders state in vendor dashboard table`
- `docs(runbook): add mitigation step for twilio sandbox latency`

---

## 3. Pull Request Guidelines

### PR Sizing & Scope
- **One task per PR**: Keep PRs strictly scoped to one specific task from the PRD's Section 8 execution plan.
- Avoid bundling unrelated changes or massive refactors. Small, focused PRs ensure quick code reviews and avoid merge conflicts during the hackathon.

### PR Naming & PRD Task Reference
- Every PR title and description **must explicitly reference the corresponding Day and Task**:
  > Format: `[Day X — Task Name] Brief description of changes`
  > Example: `[Day 2 — Orders Dashboard] Implement vendor orders list and status badges`

### Verification Before Submitting
1. Run backend tests and linter:
   ```bash
   cd backend
   ruff check .
   pytest
   ```
2. Run frontend type check, tests, and linter:
   ```bash
   cd frontend
   npm run lint
   npm run type-check
   npm run test
   ```
3. Ensure no secrets or API keys are committed.
4. Verify mobile responsiveness if modifying frontend UI components.

---

## 4. Code Review & Merge Process
- All PRs require at least **one approving review** before merging.
- All CI checks (`backend-ci` and `frontend-ci`) must pass.
- Squash and merge into `main` to maintain a clean git history.

## 5. Test Failures

A failing CI check means the code under test is wrong, not the test or the
pipeline. Investigate and fix the implementation; do not weaken the check.

Contributors must not:

- Delete or skip a failing test to make CI pass.
- Lower a coverage threshold to pass CI. The backend floor in
  `backend/pyproject.toml` may only stay the same or increase; CI compares it
  against the PR's base commit.
- Add `continue-on-error`, soft-fail flags, or `|| true` to make a red check green.
- Mark a test `xfail` or `skip` without an issue explaining why and a linked
  follow-up. Such exceptions must not be used to hide a failing stage checkpoint.

The only acceptable reason to change an existing test's expected behavior is
that the test itself encodes incorrect behavior. Explain why in the PR
description and link the requirement; never silently change an assertion.

If a stage's checkpoint test cannot pass, that stage is not done. Do not move
to the next stage's prompt until it is green. A stage with missing tests is
not complete merely because the tests that exist pass.
