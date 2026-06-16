# Xpenser PR Workflow

Use these project-specific settings with `$pr-workflow`.

## Repository

- GitHub repository: `cleverbrush/xpenser`
- Default branch: `main`
- Branch prefixes: `feat/<task-slug>` for new behavior, `fix/<task-slug>` for bug fixes.
- Worktrees belong next to the `main` checkout under sibling `feat/` or `fix/` directories.

## Validation

- Local commands:
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
- Required GitHub checks after every push:
  - `Lint and test`
  - `Deploy PR environment`
  - `Playwright e2e`
- E2e runs require `PLAYWRIGHT_BASE_URL` pointed at a deployed preview or equivalent running app.

## Preview QA

- Preview URL pattern: `https://xpenser-pr-<three-digit-pr-number>.cleverbrush.com`
- Example: PR `7` deploys to `https://xpenser-pr-007.cleverbrush.com`.
- Seeded preview account:
  - Email: `test@cleverbrush.com`
  - Password: `testPassw0rd`
- Match existing login and setup behavior in `tests/e2e/helpers.ts`.

## SigNoz

- Use resource-attribute filters whenever possible.
- Relevant service names:
  - `xpenser-web-pr-<PR number>`
  - `xpenser-api-pr-<PR number>`
  - `xpenser-telegram-bot-pr-<PR number>` when bot behavior is relevant
- Check traces, logs, and metrics for services touched by the change.

## Telegram Notification

- Notification project name: `xpenser`
- Use the preview URL as `environmentUrl`.
- Send the notification only after required checks, preview QA, and SigNoz verification are complete or explicitly skipped.
