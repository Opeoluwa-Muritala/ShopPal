# Repository injection incident: October 2026

## What happened

Obfuscated JavaScript was appended to ordinary-looking project files and font
fixtures. Startup hooks in `frontend/package.json` and hidden VS Code tasks were
then used to execute those payloads. The affected GitHub branch was force-pushed,
so pulling it without review would reintroduce an equivalent payload.

## Immediate fix

- Removed the injected JavaScript launchers and disguised font payload.
- Removed automatic VS Code task execution from the repository.
- Restored Next.js scripts so they run Next.js directly.
- Added a dependency-free repository integrity scan that runs before package
  installation or project code in CI.
- Ignored every `.env` variant except documented `.env.example` templates.

## Required account response

Treat credentials available to any account or machine that ran `npm run dev`,
`npm start`, the infected VS Code folder task, or the disguised Node files as
compromised. Rotate GitHub tokens/SSH keys and all application secrets, including
database, payment, WhatsApp, email, AI-provider, Cloudinary, and encryption keys.
Revoke old credentials rather than only generating new ones.

Review GitHub organization/repository audit logs, collaborators, deploy keys,
Actions secrets, recent workflow runs, branch protection changes, releases, and
force-push events. Rebuild deployments from a reviewed clean commit.

## Prevention controls

1. Protect `main`: require pull requests, two reviewers for workflow/config
   changes, required integrity/security checks, signed commits where practical,
   and disallow force pushes and branch deletion.
2. Add CODEOWNERS approval for `.github/**`, `.vscode/**`, lockfiles,
   `package.json`, deployment files, and this scanner.
3. Never enable repository-controlled tasks to run automatically on folder open.
4. Review dependency lifecycle scripts and run installs with `--ignore-scripts`
   during investigation. Only allow required scripts after review.
5. Keep secrets outside the repository and use least-privilege, short-lived
   credentials. Enable secret scanning and push protection.
6. Investigate surprising binary changes, large one-line diffs, executable code
   in assets, and changes that add `node`, PowerShell, shell, or network commands
   to build/editor configuration.

## Safe recovery procedure

Do not merge or reset to the compromised remote branch. Establish a reviewed
clean commit, apply the remediation on top, rotate secrets, then replace the
remote branch through an approved incident-response process. Clone it fresh on
a clean machine and run `python scripts/scan_repository_integrity.py` before any
install, editor task, build, or application command.
