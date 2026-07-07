# Contributing to xpenser

Thanks for helping improve xpenser. This repository is both a personal finance
app and a reference implementation for Cleverbrush Framework, so changes should
keep the product useful and the framework patterns easy to learn.

## Where To Start

- Use GitHub Discussions for questions, design ideas, and Cleverbrush learning
  threads.
- Use issues for actionable bugs, feature requests, and documentation gaps.
- Keep pull requests small enough to review. Prefer focused product, docs,
  test, or framework-reference improvements over broad rewrites.

Good first contribution areas:

- README and self-hosting improvements.
- API, MCP, and typed-client examples.
- UI polish on existing workflows.
- Tests around Cleverbrush contract, form, and handler behavior.
- Small product improvements to transaction, dashboard, vendor, or category
  workflows.

## Local Setup

Requirements:

- Node.js 22
- npm 11
- Docker with Docker Compose v2

Install dependencies:

```sh
npm install
```

Create local environment settings:

```sh
cp .env.example .env
```

Build shared workspaces before starting dev servers:

```sh
npm run build -w @xpenser/contracts
npm run build -w @xpenser/client
npm run build -w @xpenser/ui
```

Start PostgreSQL:

```sh
docker compose up -d postgres
```

Start the app:

```sh
npm run dev
```

Local URLs:

- Web app: http://localhost:3000
- API: http://localhost:4000
- OpenAPI JSON: http://localhost:4000/openapi.json

## Development Workflow

Before opening a pull request, run the relevant checks:

```sh
npm run lint
npm run typecheck
npm test
```

Use focused tests for the behavior you changed. Add or update Playwright tests
when changing user-facing workflows that should be validated end to end.

When a change touches API entity schemas or migrations and a live database is
available, run the read-only drift check:

```sh
npm run db:validate -w @xpenser/api
```

The e2e suite needs a running app or deployed preview:

```sh
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
```

## Cleverbrush Patterns To Preserve

- Define public API shape in `packages/contracts`.
- Keep contract tree, API endpoint metadata tree, and handler tree aligned.
- Reuse named schema constants when the same shape appears in more than one
  endpoint.
- Keep credential-bearing integrations behind server-side modules.
- Put tracing middleware before other API middleware.
- Prefer `ActionResult` helpers for expected API responses.

See [Cleverbrush Reference Notes](./docs/cleverbrush-reference.md) for the
current framework map and tests that guard these patterns.

## Pull Request Guidelines

- Describe the user-facing behavior or documentation outcome clearly.
- Include validation commands and any skipped checks with reasons.
- Add screenshots for visible UI changes.
- Keep generated artifacts, build output, local env files, and secrets out of
  the commit.
- Do not change unrelated formatting or refactor outside the request scope.

## Security

Do not report vulnerabilities in public issues. Use the process in
[SECURITY.md](./SECURITY.md).
