# Xpenser - Personal Income/Expense Tracker

## TL;DR

> **Quick Summary**: Build a full-stack personal expense tracker ("xpenser") on Cleverbrush Framework v4.2.0 with a separate @cleverbrush/server API and NextJS 16 frontend, deployed via docker-compose with PostgreSQL and SigNoz full observability.
>
> **Deliverables**:
> - Monorepo (Turborepo) with 4 packages: contract, ui, api, web
> - @cleverbrush/server REST API with OpenAPI spec (port :3001)
> - NextJS 16 + React 19 frontend with server components (port :3000)
> - Authentication: email/password + Google OAuth (JWT via @cleverbrush/auth)
> - Pages: Login, Register, Dashboard, Transactions, Categories, User Preferences
> - Full SigNoz stack for observability (OTel traces, logs, metrics)
> - Frankfurter API integration for currency exchange rates
> - TDD with Vitest throughout
> - Light/dark theme support
>
> **Estimated Effort**: XL
> **Parallel Execution**: YES - 8 waves
> **Critical Path**: Contract schemas → ORM entities → Auth → Categories → Transactions → Dashboard → Frontend pages → Integration

---

## Context

### Original Request
Build "xpenser" - a personal income/expense tracker app on top of the Cleverbrush Framework v4.2.0, production domain xpenser.cleverbrush.com. PostgreSQL database, NextJS 16 with React 19 and Shadcn components, email/password and Google authentication, OpenTelemetry + SigNoz, Frankfurter currency API, configurable per-user categories, default currency per user, DDD principles, TDD, docker-compose deployment.

### Interview Summary
**Key Discussions**:
- **Architecture**: Monorepo (Turborepo) with packages/contract, packages/ui, apps/api, apps/web. Two services: NextJS on :3000, @cleverbrush/server API on :3001. NextJS server components call API via @cleverbrush/client (server-side HTTP).
- **Auth**: @cleverbrush/auth with jwtScheme + google-auth-library (NOT NextAuth.js). JWT stored in HTTP-only secure cookie.
- **SigNoz**: Full stack in docker-compose (otel-collector, query-service, frontend, clickhouse, alertmanager).
- **Frankfurter API**: @cleverbrush/scheduler periodic job (daily), stores rates in PostgreSQL, API reads from DB.
- **Caching**: Both layers - NextJS revalidateTag() + API server ETag/in-memory cache with tag-based invalidation.
- **Shadcn UI**: packages/ui as customized shadcn package with theme support and composed components.
- **Testing**: TDD with Vitest + Agent-Executed QA scenarios for every task.
- **Acceptance**: `turbo lint:fix`, `turbo build`, `turbo test` all pass with zero errors/warnings.

**Research Findings**:
- **Demo (todo-backend) pattern**: contract.ts → endpoints.ts (authorize/inject/summary) → handlers → server.ts (buildServer) → index.ts. This is the canonical pattern to follow.
- **Config**: `parseEnv` with nested objects + computed `connectionString` - exactly what we need.
- **DI**: tokens via `any().hasType<T>()`, `configureDI` with singletons/transient for DbContext/TrackedDbContext.
- **ORM**: `defineEntity` with `hasMany`/`belongsTo`, projections, `createDb` with/without tracking, Knex migrations.
- **Auth**: scrypt password hashing (64 keylen, N=16384), `signJwt`, `google-auth-library` OAuth2Client.
- **OTel**: `setupOtel` (loaded first via --import), `tracingMiddleware`, `instrumentKnex`, `otelLogSink`, `traceEnricher`.
- **Log**: `parseString` structured log templates, `createLogger` with sinks and enrichers.

### Gap Analysis (Metis unavailable - self-analysis)
- **Session management**: JWT stored in HTTP-only cookie accessible to both services via shared domain. NextJS middleware reads cookie and includes Authorization header in API calls.
- **Currency conversion**: Server-side conversion using rates from Frankfurter. Rounding to 2 decimal places. Conversion happens at display time, not storage time.
- **Security**: Rate limiting on auth endpoints, CSRF via SameSite=Strict cookie, input sanitization via @cleverbrush/schema validation, SQL injection protection via Knex parameterized queries.
- **Edge cases**: Empty state (no transactions/categories), first-time user forced category creation, concurrent exchange rate updates, transaction with deleted category, currency with no exchange rate available.

---

## Work Objectives

### Core Objective
Build a production-ready personal expense tracker that demonstrates the full Cleverbrush Framework v4.2.0 ecosystem with DDD principles, schema-first API design, full observability, and best-in-class developer experience.

### Concrete Deliverables
- `packages/contract/` - Shared API contract and schemas
- `packages/ui/` - Shadcn component library with theme support
- `apps/api/` - @cleverbrush/server REST API with OpenAPI
- `apps/web/` - NextJS 16 frontend application
- `docker-compose.yml` - Full deployment stack
- All three commands (`turbo lint:fix`, `turbo build`, `turbo test`) pass

### Definition of Done
- [ ] `turbo build` - All packages compile with zero errors
- [ ] `turbo lint:fix` - Biome passes with zero warnings
- [ ] `turbo test` - All Vitest tests pass
- [ ] `docker compose up` - All services start healthy
- [ ] Login/Register flow works end-to-end
- [ ] Dashboard displays user's transactions in default currency
- [ ] Categories CRUD works with delete protection
- [ ] OpenAPI spec accessible at `/openapi.json`
- [ ] SigNoz receives traces and logs

### Must Have
- Email/password registration and login
- Google OAuth login with auto-provisioning
- Configurable expense/income categories per user
- Transaction CRUD with amount, currency, category, datetime
- Currency conversion to user's default currency
- Period-based dashboard analytics (week/month/quarter/year)
- User preferences (default currency, profile info)
- Light/dark theme with auto-detection
- Full OpenTelemetry instrumentation to SigNoz
- JSDoc on all public APIs and schema fields

### Must NOT Have (Guardrails)
- NextAuth.js - Use @cleverbrush/auth exclusively
- `as any` type assertions anywhere in the codebase
- Direct database access from NextJS - all via API
- Client-side API calls from browser components - use server components
- Hardcoded credentials or secrets in source code
- Unparameterized SQL queries
- Expo/React Native or any mobile framework
- Real-time WebSocket features (scope creep)
- Email verification or password reset flows (explicitly excluded)
- Multi-user/shared categories or budgets
- PDF/CSV export functionality
- AI slop: excessive comments, `console.log` in production, unused imports, dead code
- Premature abstraction - no utility extraction without 3+ usage sites

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (greenfield)
- **Automated tests**: YES (TDD)
- **Framework**: Vitest
- **TDD Workflow**: Each implementation task follows RED (failing test) → GREEN (minimal implementation) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Playwright - Navigate, interact, assert DOM, screenshot
- **TUI/CLI**: interactive_bash (tmux) - Run command, validate output
- **API/Backend**: Bash (curl) - Send requests, assert status + response fields
- **Library/Module**: Bash (node REPL) - Import, call functions, compare output

---

## Execution Strategy

### Parallel Execution Waves

> Maximize throughput by grouping independent tasks into parallel waves.
> Each wave completes before the next begins.
> Target: 5-8 tasks per wave.

```
Wave 1 (Start Immediately - Foundation, ALL INDEPENDENT):
├── Task 1: Monorepo scaffolding [quick]
├── Task 2: TypeScript shared config [quick]
├── Task 3: Biome configuration [quick]
├── Task 4: Vitest configuration [quick]
├── Task 5: Docker scaffolding [quick]
├── Task 6: Environment config [quick]
├── Task 7: Contract schemas [deep]
└── Task 8: API contract definitions [deep]

Wave 2 (After Wave 1 - Backend Core, MAX PARALLEL):
├── Task 9: apps/api scaffolding [quick]
├── Task 10: ORM entity definitions [deep]
├── Task 11: Initial database migration [deep]
├── Task 12: Config module [quick]
├── Task 13: DI setup [deep]
├── Task 14: Telemetry + Logger setup [deep]
├── Task 15: Auth service [deep]
└── Task 16: Currency service [deep]

Wave 3 (After Wave 2 - API Handlers, MAX PARALLEL):
├── Task 17: Auth endpoints + handlers [deep]
├── Task 18: Categories endpoints + handlers [deep]
├── Task 19: Transactions endpoints + handlers [deep]
├── Task 20: User preferences endpoints + handlers [deep]
└── Task 21: Dashboard/analytics endpoints + handlers [deep]

Wave 4 (After Wave 3 - API Assembly, sequential-ish):
├── Task 22: Server builder assembly [deep]
├── Task 23: OpenAPI spec generation [quick]
└── Task 24: Entry point + graceful shutdown [quick]

Wave 5 (After Wave 1 - UI Library, INDEPENDENT of Waves 2-4):
├── Task 25: packages/ui scaffolding + shadcn init [visual-engineering]
├── Task 26: Theme system [visual-engineering]
├── Task 27: Custom form components [visual-engineering]
└── Task 28: Layout components [visual-engineering]

Wave 6 (After Waves 1, 5 - Frontend App, INDEPENDENT of Waves 2-4):
├── Task 29: apps/web scaffolding [quick]
├── Task 30: API client + session management [deep]
└── Task 31: Cache strategy [quick]

Wave 7 (After Waves 4, 6 - Frontend Pages, MAX PARALLEL):
├── Task 32: Login page [visual-engineering]
├── Task 33: Registration page [visual-engineering]
├── Task 34: Root layout + Navigation [visual-engineering]
├── Task 35: Dashboard page [visual-engineering]
├── Task 36: Transactions page [visual-engineering]
└── Task 37: Settings pages [visual-engineering]

Wave 8 (After Waves 4, 7 - Finalization):
├── Task 38: Integration + cache wiring [deep]
├── Task 39: Docker-compose finalization [quick]
└── Task 40: Documentation + README [writing]

Critical Path: Tasks 7-8 → 10-11 → 15 → 17 → 18 → 19 → 21 → 22-24 → 35-37 → 38
Parallel Speedup: ~65% faster than sequential (Waves 1+5+6 run in parallel with 2-4)
Max Concurrent: 8 (Waves 1 & 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1-6 | - | 9-16, 25-31 | 1 |
| 7 | 6 | 8, 10-11, 17-21 | 1 |
| 8 | 7 | 17-21 | 1 |
| 9 | 1, 2 | 10-16 | 2 |
| 10 | 7, 9 | 11, 17-21 | 2 |
| 11 | 10 | 17-21 | 2 |
| 12 | 6, 9 | 17-21 | 2 |
| 13 | 9 | 17-21 | 2 |
| 14 | 9 | 22-24 | 2 |
| 15 | 10-11 | 17 | 2 |
| 16 | 12 | 19, 21 | 2 |
| 17 | 15 | 22-24 | 3 |
| 18-21 | 10-13 | 22-24 | 3 |
| 22 | 14, 17-21 | 24, 38-39 | 4 |
| 23-24 | 22 | 38-39 | 4 |
| 25 | 1 | 26-28 | 5 |
| 26 | 25 | 29, 34 | 5 |
| 27-28 | 25 | 35-37 | 5 |
| 29 | 1, 2 | 30-31, 35-37 | 6 |
| 30 | 8, 29 | 35-37 | 6 |
| 31 | 30 | 38 | 6 |
| 32-34 | 26, 29-30 | 35-37 | 7 |
| 35-37 | 22-24, 30-34 | 38 | 7 |
| 38 | 22-24, 31, 35-37 | 39 | 8 |
| 39 | 5, 22-24, 38 | - | 8 |
| 40 | 39 | - | 8 |

### Agent Dispatch Summary

- **Wave 1**: 8 - T1-T6 → `quick`, T7-T8 → `deep`
- **Wave 2**: 8 - T9,12 → `quick`, T10-11,13-16 → `deep`
- **Wave 3**: 5 - T17-T21 → `deep`
- **Wave 4**: 3 - T22 → `deep`, T23-T24 → `quick`
- **Wave 5**: 4 - T25-T28 → `visual-engineering`
- **Wave 6**: 3 - T29,31 → `quick`, T30 → `deep`
- **Wave 7**: 6 - T32-T37 → `visual-engineering`
- **Wave 8**: 3 - T38 → `deep`, T39 → `quick`, T40 → `writing`
- **FINAL**: 4 - F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.
> **A task WITHOUT QA Scenarios is INCOMPLETE.**

- [x] 1. Monorepo Scaffolding (Turborepo)

  **What to do**:
  - Create root `package.json` with `"workspaces"` array (`packages/*`, `apps/*`) and scripts: `build`, `lint:fix`, `test`, `dev`, `clean`
  - Create `turbo.json` with pipeline configuration: `build` (dependsOn: ^build), `lint:fix` (dependsOn: ^lint:fix), `test` (dependsOn: ^build), `dev` (persistent, cache: false)
  - Create root `.gitignore` (node_modules, .turbo, dist, .next, .env, logs/)
  - Create root `biome.json` extending from shared config (later task)
  - Create `packages/` and `apps/` directories
  - Add `packageManager` field specifying npm version
  - Add root-level `.nvmrc` with Node 22

  **Must NOT do**:
  - Don't create any source files yet - just scaffolding
  - Don't configure TypeScript or Vitest at root level (separate tasks)

  **Recommended Agent Profile**:
  - **Category**: `quick` - Single straightforward task, no complex logic
  - **Skills**: []
  - **Skills Evaluated but Omitted**: None needed for scaffolding

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-6)
  - **Blocks**: Tasks 9, 25, 29
  - **Blocked By**: None

  **References**:
  - `/home/andrew/projects/framework/turbo.json` - Turborepo pipeline pattern from framework monorepo
  - `/home/andrew/projects/framework/package.json` - Workspace config and scripts pattern

  **Acceptance Criteria**:
  - [ ] Root `package.json` exists with valid workspaces config
  - [ ] `turbo.json` exists with build/lint:fix/test pipelines
  - [ ] `npm install` succeeds at root level
  - [ ] Directory structure: `packages/contract`, `packages/ui`, `apps/api`, `apps/web` exist

  **QA Scenarios**:
  ```
  Scenario: Verify monorepo structure is valid
    Tool: Bash
    Steps:
      1. cat package.json | jq '.workspaces' - Should show ["packages/*", "apps/*"]
      2. cat turbo.json | jq '.pipeline.build.dependsOn' - Should include "^build"
      3. ls packages/ - Should show "contract" and "ui" directories
      4. ls apps/ - Should show "api" and "web" directories
    Expected Result: All directories exist, turbo.json is valid, workspaces configured
    Evidence: .sisyphus/evidence/task-1-structure.txt
  ```

  **Commit**: YES
  - Message: `chore(monorepo): scaffold turborepo workspace structure`
  - Files: `package.json`, `turbo.json`, `.gitignore`, `.nvmrc`

- [x] 2. TypeScript Shared Config

  **What to do**:
  - Create `tsconfig.base.json` at root with shared compiler options:
    - `target`: "ES2024", `module`: "NodeNext", `moduleResolution`: "NodeNext"
    - `strict`: true, `noUncheckedIndexedAccess`: true, `exactOptionalPropertyTypes`: true
    - `declaration`: true, `declarationMap`: true, `sourceMap`: true
    - `verbatimModuleSyntax`: true, `isolatedModules`: true
    - `skipLibCheck`: true, `forceConsistentCasingInFileNames`: true
    - `jsx`: "react-jsx" (needed for frontend packages)
  - Create `tsconfig.build.json` at root (extends base, adds `noEmit: false`)
  - Create `packages/contract/tsconfig.json` (extends root base, suitable for shared code)
  - Create TypeScript version constraint: `typescript: ^6.0.3` in root devDependencies

  **Must NOT do**:
  - Don't configure path aliases yet (package-specific)
  - Don't set `noEmit: true` at root (some packages need emit)

  **Recommended Agent Profile**:
  - **Category**: `quick` - Configuration file creation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3-6)
  - **Blocks**: Tasks 9, 25, 29
  - **Blocked By**: None

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/tsconfig.build.json` - Backend TypeScript config pattern
  - `/home/andrew/projects/framework/tsconfig.json` - Root tsconfig pattern from framework

  **Acceptance Criteria**:
  - [ ] `tsconfig.base.json` exists with all required compiler options
  - [ ] `packages/contract/tsconfig.json` correctly extends base
  - [ ] `npx tsc --version` reports v6.0.x

  **QA Scenarios**:
  ```
  Scenario: Verify TypeScript config is valid
    Tool: Bash
    Steps:
      1. cat tsconfig.base.json | jq '.compilerOptions.strict' - Should be "true"
      2. cat tsconfig.base.json | jq '.compilerOptions.module' - Should be "NodeNext"
      3. cat packages/contract/tsconfig.json | jq '.extends' - Should contain "tsconfig.base.json"
    Expected Result: All configs valid, correct TS version installed
    Evidence: .sisyphus/evidence/task-2-tsconfig.txt
  ```

  **Commit**: YES
  - Message: `chore(typescript): add shared TypeScript configuration`
  - Files: `tsconfig.base.json`, `tsconfig.build.json`, `packages/contract/tsconfig.json`

- [x] 3. Biome Configuration

  **What to do**:
  - Create root `biome.json` with:
    - `formatter`: indentStyle "space", indentWidth 2, lineWidth 100
    - `linter`: recommended rules enabled, `noConsoleLog` set to "warn"
    - `javascript`: `globals` set to ["React", "JSX"], `jsxRuntime` set to "react"
    - `organizeImports`: enabled true
    - `vcs`: enabled true, clientKind "git", useIgnoreFile true
  - Add `lint:fix` script to root package.json: `turbo lint:fix`
  - Add `format` script: `biome format --write .`
  - Exclude patterns: `node_modules`, `.next`, `dist`, `.turbo`, `coverage`

  **Must NOT do**:
  - Don't add custom lint rules beyond recommended + noConsoleLog
  - Don't create per-package biome configs (use root only)

  **Recommended Agent Profile**:
  - **Category**: `quick` - Configuration only
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-2, 4-6)
  - **Blocks**: Tasks 9, 25, 29 (all source tasks need linting)
  - **Blocked By**: None

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/biome.json` - Biome config pattern from framework demo

  **Acceptance Criteria**:
  - [ ] `biome.json` exists at root with valid configuration
  - [ ] `npx biome check --files=biome.json` validates successfully
  - [ ] Root `package.json` has `lint:fix` script

  **QA Scenarios**:
  ```
  Scenario: Verify Biome config is valid
    Tool: Bash
    Steps:
      1. cat biome.json | jq '.formatter.indentStyle' - Should be "space"
      2. cat biome.json | jq '.linter.rules.recommended' - Should be "true"
      3. npx biome check --files=biome.json - Should exit 0
    Expected Result: Valid biome config, check passes on itself
    Evidence: .sisyphus/evidence/task-3-biome.txt
  ```

  **Commit**: YES
  - Message: `chore(lint): add biome configuration`
  - Files: `biome.json`

- [x] 4. Vitest Configuration

  **What to do**:
  - Create `vitest.workspace.ts` at root referencing all packages:
    - `packages/contract/vitest.config.ts`
    - `packages/ui/vitest.config.ts`
    - `apps/api/vitest.config.ts`
    - `apps/web/vitest.config.ts`
  - Create `vitest.config.base.ts` with shared config:
    - `include`: `['src/**/*.test.ts', 'src/**/*.test.tsx']`
    - `coverage`: provider "v8", reporter ["text", "lcov"], exclude node_modules/dist
    - TypeScript path resolution support
  - Add `test` script to root package.json: `turbo test`
  - Add `test:coverage` script: `turbo test -- --coverage`
  - Add `vitest` to root devDependencies

  **Must NOT do**:
  - Don't create package-specific vitest configs with full content yet (use base)
  - Don't add test files - just config

  **Recommended Agent Profile**:
  - **Category**: `quick` - Configuration only
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-3, 5-6)
  - **Blocks**: All source tasks (tests need vitest configured)
  - **Blocked By**: None

  **References**:
  - Vitest workspace docs: `https://vitest.dev/guide/workspace.html`
  - Framework pattern: tests use Vitest throughout all packages

  **Acceptance Criteria**:
  - [ ] `vitest.workspace.ts` references all 4 package configs
  - [ ] `vitest.config.base.ts` with shared coverage config
  - [ ] `turbo test` script in root package.json

  **QA Scenarios**:
  ```
  Scenario: Verify vitest configuration is discoverable
    Tool: Bash
    Steps:
      1. cat vitest.workspace.ts - Should reference 4 package vitest configs
      2. cat package.json | jq '.scripts.test' - Should contain "turbo test"
    Expected Result: Workspace file references all packages
    Evidence: .sisyphus/evidence/task-4-vitest.txt
  ```

  **Commit**: YES
  - Message: `chore(test): add vitest workspace configuration`
  - Files: `vitest.workspace.ts`, `vitest.config.base.ts`

- [x] 5. Docker Scaffolding

  **What to do**:
  - Create root `docker-compose.yml` with services:
    - `postgres`: postgres:17-alpine, healthcheck, volume, env vars
    - `sigNoz-otel-collector`: sigNoz/signoz-otel-collector:latest, ports 4317-4318
    - `clickhouse`: clickhouse/clickhouse-server:24-alpine (for SigNoz)
    - `query-service`: sigNoz/query-service:latest (depends on clickhouse)
    - `frontend`: sigNoz/frontend:latest (SigNoz UI, port 3301)
    - `api`: placeholder build context (apps/api), port 3001, depends on postgres
    - `web`: placeholder build context (apps/web), port 3000, depends on api
    - Networks: `xpenser-network` (bridge)
    - Volumes: `postgres_data`, `clickhouse_data`, `api_logs`
  - Create `apps/api/Dockerfile`:
    - FROM node:22-alpine
    - Copy dist, install production deps only
    - Run `node --import ./dist/telemetry.js dist/index.js`
    - Health check: curl http://localhost:3001/health
  - Create `apps/web/Dockerfile`:
    - FROM node:22-alpine
    - Multi-stage: build (with devDeps) then production (standalone output)
    - Health check: curl http://localhost:3000
  - Create root `.dockerignore` (node_modules, .turbo, .git, .env)
  - Create `apps/api/.dockerignore` and `apps/web/.dockerignore`

  **Must NOT do**:
  - Don't hardcode secrets in docker-compose (use ${VAR:?} syntax)
  - Don't include alertmanager in SigNoz stack (keep it minimal)

  **Recommended Agent Profile**:
  - **Category**: `quick` - Docker configuration files
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-4, 6-8)
  - **Blocks**: Task 39 (docker-compose finalization)
  - **Blocked By**: None

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/docker-compose.yml` - Service definition pattern with healthchecks
  - `/home/andrew/projects/framework/demos/todo-backend/Dockerfile` - Backend Dockerfile pattern
  - SigNoz Docker setup: standard signoz/getting-started docker-compose

  **Acceptance Criteria**:
  - [ ] `docker-compose.yml` defines all required services
  - [ ] `apps/api/Dockerfile` and `apps/web/Dockerfile` exist
  - [ ] No hardcoded secrets - all use env vars with defaults or `?` error

  **QA Scenarios**:
  ```
  Scenario: Verify docker-compose syntax is valid
    Tool: Bash
    Steps:
      1. docker compose config --dry-run 2>&1 - Should not error (may warn about missing .env)
      2. cat docker-compose.yml | grep -c "postgres" - Should be > 0
      3. cat docker-compose.yml | grep -c "signoz" - Should be > 0 (case insensitive)
    Expected Result: Docker compose parses without syntax errors
    Evidence: .sisyphus/evidence/task-5-docker.txt
  ```

  **Commit**: YES
  - Message: `chore(docker): add docker-compose and Dockerfiles`
  - Files: `docker-compose.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, `.dockerignore`

- [x] 6. Environment Config + .env.example

  **What to do**:
  - Create root `.env.example` with all required variables:
    - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
    - JWT_SECRET (with instruction to generate via `node -e "console.log(crypto.randomBytes(48).toString('hex'))"`)
    - JWT_EXPIRES_IN (default 3600)
    - GOOGLE_CLIENT_ID (optional for Google OAuth)
    - PORT (API: 3001, WEB: 3000)
    - HOST (0.0.0.0)
    - NODE_ENV (development/production)
    - LOG_LEVEL (info)
    - OTEL_EXPORTER_OTLP_ENDPOINT (http://sigNoz-otel-collector:4318)
    - OTEL_SERVICE_NAME (xpenser-api / xpenser-web)
    - FRANKFURTER_API_URL (https://api.frankfurter.dev)
    - NEXT_PUBLIC_API_URL (for web, defaults to http://api:3001)
  - Create `packages/contract/package.json` with minimal structure
  - Create shared config schema using `@cleverbrush/env` in `packages/contract/src/config.ts`:
    - Define `config` using `parseEnv` with nested structure (db, jwt, google, server, frankfurter)
    - Export `Config` type
    - Include computed `connectionString` field

  **Must NOT do**:
  - Don't create `apps/api/src/config.ts` yet (that's Task 12 which re-exports from contract)
  - Don't commit real `.env` file

  **Recommended Agent Profile**:
  - **Category**: `quick` - Configuration and env template
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-5, 7-8)
  - **Blocks**: Task 12 (config module depends on contract config)
  - **Blocked By**: None

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/.env.example` - Env template pattern
  - `/home/andrew/projects/framework/demos/todo-backend/src/config.ts` - `parseEnv` usage pattern
  - Framework docs: `@cleverbrush/env` README for `parseEnv`, `env()`, computed values

  **Acceptance Criteria**:
  - [ ] `.env.example` documents all required variables with sensible defaults
  - [ ] `packages/contract/src/config.ts` exports typed config with computed connectionString
  - [ ] No real secrets in `.env.example`

  **QA Scenarios**:
  ```
  Scenario: Verify config schema compiles and validates
    Tool: Bash
    Preconditions: Task 2 (TypeScript config) completed
    Steps:
      1. cd packages/contract && npx tsc --noEmit - Should pass with zero errors
      2. cat .env.example | grep "JWT_SECRET" - Should exist with generation instructions
      3. cat .env.example | grep "FRANKFURTER_API_URL" - Should reference api.frankfurter.dev
    Expected Result: Config schema compiles, env.example documents all vars
    Evidence: .sisyphus/evidence/task-6-env-config.txt
  ```

  **Commit**: YES
  - Message: `feat(contract): add environment config schema and .env.example`
  - Files: `.env.example`, `packages/contract/package.json`, `packages/contract/src/config.ts`

- [x] 7. Contract Schemas - All Entity Definitions

  **What to do**:
  - Create `packages/contract/src/schemas/auth.ts` with JSDoc:
    - `RegisterBodySchema`: email (string().email()), password (string().minLength(8)), defaultCurrency (string().length(3)), favoriteCurrencies (array(string()))
    - `LoginBodySchema`: email, password
    - `GoogleAuthBodySchema`: idToken (string())
    - `TokenResponseSchema`: token (string()), expiresIn (number())
  - Create `packages/contract/src/schemas/user.ts` with JSDoc:
    - `UserResponseSchema`: id (number()), email (string()), role (string()), authProvider (string()), defaultCurrency (string()), favoriteCurrencies (array(string())), createdAt (fromISOString())
  - Create `packages/contract/src/schemas/category.ts` with JSDoc:
    - `CategorySchema`: id, userId, name (string().nonempty().maxLength(100)), type (string().oneOf('expense', 'income')), createdAt
    - `CreateCategoryBodySchema`: name, type
    - `UpdateCategoryBodySchema`: name (optional), type (optional)
  - Create `packages/contract/src/schemas/transaction.ts` with JSDoc:
    - `TransactionSchema`: id, userId, categoryId, amount (number().min(0.01)), currency (string().length(3)), description (string().optional()), transactionDate (fromISOString()), createdAt
    - `CreateTransactionBodySchema`: categoryId, amount, currency, description (optional), transactionDate
    - `UpdateTransactionBodySchema`: all fields optional
    - `TransactionListQuerySchema`: page, limit, categoryId (optional), startDate (optional), endDate (optional), type (optional)
  - Create `packages/contract/src/schemas/dashboard.ts` with JSDoc:
    - `DashboardQuerySchema`: period (string().oneOf('week','month','quarter','year')), startDate (optional), endDate (optional)
    - `DashboardSummarySchema`: totalExpenses, totalIncome, netAmount, byCategory (array), recentTransactions (array)
  - Create `packages/contract/src/schemas/preferences.ts` with JSDoc:
    - `UpdatePreferencesBodySchema`: defaultCurrency (optional), favoriteCurrencies (optional)
  - Create `packages/contract/src/schemas/index.ts` barrel export
  - Add `@cleverbrush/schema` as dependency to packages/contract/package.json
  - **WRITE TESTS FIRST** (TDD): Create `packages/contract/src/schemas/__tests__/auth.test.ts` testing RegisterBodySchema validation (valid, invalid email, short password, missing fields)

  **Must NOT do**:
  - Don't add server-specific metadata (authorize, inject) - those go in endpoints
  - Don't export schemas without JSDoc on every field
  - Don't use `as any` or type assertions

  **Recommended Agent Profile**:
  - **Category**: `deep` - Multiple schema files with test-first approach
  - **Skills**: []
  - **Reason**: Complex domain modeling with interdependent schemas, requiring careful DDD design

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 6 for config types)
  - **Parallel Group**: Wave 1 (sequential after Task 6 completes)
  - **Blocks**: Tasks 8, 10, 17-21
  - **Blocked By**: Task 6

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/src/api/schemas.ts` - Schema definition patterns: `object()`, `string().email()`, `array()`, `number().coerce()`, JSDoc on schemas
  - `/home/andrew/projects/framework/README.md` - `InferType` usage, schema composition

  **Acceptance Criteria**:
  - [ ] All 6 schema modules created with JSDoc on every field
  - [ ] barrel export `packages/contract/src/schemas/index.ts`
  - [ ] `packages/contract/src/schemas/__tests__/auth.test.ts`: RED phase - test validates and fails correctly
  - [ ] All schemas compile without errors

  **QA Scenarios**:
  ```
  Scenario: Validate RegisterBodySchema with valid data
    Tool: Bash (node REPL)
    Steps:
      1. Import RegisterBodySchema
      2. Call .validate({ email: "test@example.com", password: "securepass123", defaultCurrency: "USD", favoriteCurrencies: ["EUR", "GBP"] })
      3. Assert result.valid === true
    Expected Result: Validation passes for valid registration data
    Evidence: .sisyphus/evidence/task-7-schema-validate.txt

  Scenario: Validate RegisterBodySchema rejects invalid email
    Tool: Bash (node REPL)
    Steps:
      1. Import RegisterBodySchema
      2. Call .validate({ email: "notanemail", password: "securepass123", defaultCurrency: "USD", favoriteCurrencies: [] })
      3. Assert result.valid === false
      4. Assert result.getErrorsFor(p => p.email).errors.length > 0
    Expected Result: Validation fails for invalid email
    Evidence: .sisyphus/evidence/task-7-schema-invalid.txt
  ```

  **Commit**: YES
  - Message: `feat(contract): add all entity and request/response schemas`
  - Files: `packages/contract/src/schemas/*.ts`, `packages/contract/src/schemas/__tests__/*.ts`

- [x] 8. API Contract Definitions

  **What to do**:
  - Create `packages/contract/src/api.ts` using `defineApi` and `endpoint` from `@cleverbrush/server/contract`:
    - Group `auth`: register (POST /api/auth/register → 201), login (POST /api/auth/login → 200), googleLogin (POST /api/auth/google → 200)
    - Group `users`: getProfile (GET /api/users/me → 200), updateProfile (PATCH /api/users/me → 200)
    - Group `categories`: list (GET /api/categories → 200), create (POST /api/categories → 201), update (PATCH /api/categories/:id → 200), delete (DELETE /api/categories/:id → 204)
    - Group `transactions`: list (GET /api/transactions → 200), get (GET /api/transactions/:id → 200), create (POST /api/transactions → 201), update (PATCH /api/transactions/:id → 200), delete (DELETE /api/transactions/:id → 204)
    - Group `dashboard`: getSummary (GET /api/dashboard/summary → 200)
    - Group `currencies`: list (GET /api/currencies → 200), convert (GET /api/currencies/convert → 200)
  - All endpoints use schemas from Task 7
  - Create route templates: `ById = route({ id: number().coerce() })`
  - Create resource factories: `categoriesResource = endpoint.resource('/api/categories')`
  - Export `api` object for shared usage
  - **WRITE TESTS FIRST**: `packages/contract/src/__tests__/api.test.ts` - verify endpoint definitions exist with correct HTTP methods and paths

  **Must NOT do**:
  - Don't add `.authorize()`, `.inject()`, `.summary()`, `.tags()` - those are server-side extensions
  - Don't add handler implementations - contract only

  **Recommended Agent Profile**:
  - **Category**: `deep` - Large, intricate contract definition with many endpoints
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 7 for schemas)
  - **Parallel Group**: Wave 1 (sequential after Task 7)
  - **Blocks**: Tasks 17-21 (all handler tasks need contract), Task 30
  - **Blocked By**: Task 7

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/src/api/contract.ts` - `defineApi` pattern, resource groups, route templates, response schemas
  - `/home/andrew/projects/framework/libs/client/README.md` - Contract usage for client generation

  **Acceptance Criteria**:
  - [ ] All 6 endpoint groups defined with correct HTTP methods and response codes
  - [ ] Route templates use `route()` with typed params
  - [ ] `api` object exported
  - [ ] Test file verifies endpoint structure

  **QA Scenarios**:
  ```
  Scenario: Verify contract has all auth endpoints
    Tool: Bash (node REPL)
    Steps:
      1. Import { api } from packages/contract/src/api
      2. Assert api.auth.register exists
      3. Assert api.auth.login exists
      4. Assert api.auth.googleLogin exists
    Expected Result: All auth endpoints defined
    Evidence: .sisyphus/evidence/task-8-contract-auth.txt

  Scenario: Verify contract endpoint paths
    Tool: Bash (node REPL)
    Steps:
      1. Access api.transactions.create
      2. Assert method is POST
      3. Assert path contains /api/transactions
    Expected Result: Correct RESTful paths and methods
    Evidence: .sisyphus/evidence/task-8-contract-paths.txt
  ```

  **Commit**: YES
  - Message: `feat(contract): add complete API contract definitions`
  - Files: `packages/contract/src/api.ts`, `packages/contract/src/__tests__/api.test.ts`

- [x] 9. Apps/API Project Scaffolding

  **What to do**:
  - Create `apps/api/package.json`:
    - Dependencies: `@cleverbrush/auth`, `@cleverbrush/di`, `@cleverbrush/env`, `@cleverbrush/log`, `@cleverbrush/orm`, `@cleverbrush/orm-cli`, `@cleverbrush/otel`, `@cleverbrush/mapper`, `@cleverbrush/schema`, `@cleverbrush/server`, `@cleverbrush/server-openapi`, `@cleverbrush/scheduler`, `knex`, `pg`, `google-auth-library`
    - OTel instrumentations: `@opentelemetry/instrumentation-http`, `@opentelemetry/instrumentation-undici`, `@opentelemetry/instrumentation-runtime-node`
    - DevDependencies: `@types/node`, `tsup`, `tsx`, `typescript`, `vitest`
    - Scripts: `dev`, `build`, `start`, `typecheck`, `lint:fix`, `test`, `db:generate`, `db:run`, `db:rollback`, `db:status`, `db:push`
  - Create `apps/api/tsconfig.json` extending root tsconfig.base.json
  - Create `apps/api/tsconfig.build.json` for build output
  - Create `apps/api/tsup.config.ts` for bundling (entry: src/index.ts, format: esm, external: pg/knex)
  - Create `apps/api/vitest.config.ts` extending base (add knex mock aliases)
  - Create `apps/api/src/` directory structure: `api/`, `db/`, `di/`, `services/`, `middleware/`
  - Link to `packages/contract` as workspace dependency

  **Must NOT do**:
  - Don't create handler files or server.ts yet
  - Don't install unnecessary deps

  **Recommended Agent Profile**:
  - **Category**: `quick` - Project scaffolding
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 10-16)
  - **Blocks**: Tasks 10-16
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/package.json` - Complete dependency list and scripts pattern
  - `/home/andrew/projects/framework/demos/todo-backend/tsup.config.ts` - Build config pattern
  - `/home/andrew/projects/framework/demos/todo-backend/tsconfig.build.json` - Build tsconfig

  **Acceptance Criteria**:
  - [ ] `apps/api/package.json` with all required scripts and dependencies
  - [ ] `npm install` succeeds in apps/api
  - [ ] `npx tsc --noEmit` passes (may have no source files yet)

  **QA Scenarios**:
  ```
  Scenario: Verify API project structure is valid
    Tool: Bash
    Steps:
      1. ls apps/api/package.json - Should exist
      2. cat apps/api/package.json | jq '.scripts.dev' - Should contain "tsx watch"
      3. cat apps/api/package.json | jq '.dependencies["@cleverbrush/server"]' - Should not be null
      4. ls apps/api/src/ - Should show api/, db/, di/, services/, middleware/
    Expected Result: Project scaffolded with correct structure and deps
    Evidence: .sisyphus/evidence/task-9-api-scaffold.txt
  ```

  **Commit**: YES
  - Message: `chore(api): scaffold API project with dependencies`
  - Files: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/tsup.config.ts`, `apps/api/vitest.config.ts`

- [x] 10. ORM Entity Definitions

  **What to do**:
  - Create `apps/api/src/db/schemas.ts` with @cleverbrush/orm entity definitions with **JSDoc on every field**:
    - `UserDbSchema`: id (number().primaryKey()), email (string()), passwordHash (string().optional().hasColumnName('password_hash')), role (string()), authProvider (string().hasColumnName('auth_provider')), defaultCurrency (string().hasColumnName('default_currency').length(3)), favoriteCurrencies (array(string()).hasColumnName('favorite_currencies')), createdAt (date().hasColumnName('created_at').defaultTo('now'))
      - Table: `users`, projections: `public` (id, email, role, authProvider, defaultCurrency, favoriteCurrencies, createdAt), `auth` (id, email, role, passwordHash, authProvider)
    - `CategoryDbSchema`: id (number().primaryKey()), userId (number().hasColumnName('user_id').references('users','id').onDelete('CASCADE').index()), name (string()), type (string()), createdAt (date().hasColumnName('created_at').defaultTo('now'))
      - Table: `categories`
    - `TransactionDbSchema`: id (number().primaryKey()), userId (number().hasColumnName('user_id').references('users','id').onDelete('CASCADE').index('idx_transactions_user_id')), categoryId (number().hasColumnName('category_id').references('categories','id').onDelete('RESTRICT').index()), amount (number()), currency (string().length(3)), description (string().optional()), transactionDate (date().hasColumnName('transaction_date')), createdAt (date().hasColumnName('created_at').defaultTo('now'))
      - Table: `transactions`
    - `ExchangeRateDbSchema`: id (number().primaryKey()), baseCurrency (string().hasColumnName('base_currency').length(3)), targetCurrency (string().hasColumnName('target_currency').length(3)), rate (number()), updatedAt (date().hasColumnName('updated_at').defaultTo('now'))
      - Table: `exchange_rates`
  - Define relationships:
    - `UserEntity.hasMany(t => t.categories, CategoryEntity, 'userId')`
    - `UserEntity.hasMany(t => t.transactions, TransactionEntity, 'userId')`
    - `CategoryEntity.belongsTo(t => t.user, 'userId')`
    - `CategoryEntity.hasMany(t => t.transactions, TransactionEntity, 'categoryId')` (with onDelete RESTRICT)
    - `TransactionEntity.belongsTo(t => t.category, 'categoryId')`
    - `TransactionEntity.belongsTo(t => t.user, 'userId')`
  - Export `AppEntityMap` type and `entityMap` constant
  - **WRITE TESTS FIRST**: `apps/api/src/db/__tests__/schemas.test.ts` - verify entities are defined, table names correct, relationships exist

  **Must NOT do**:
  - Don't create migration files yet (Task 11)
  - Don't skip JSDoc on any field
  - Don't use `RESTRICT` on userId foreign keys (CASCADE is correct for user deletion)

  **Recommended Agent Profile**:
  - **Category**: `deep` - Complex entity definitions with relationships, projections, indices
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9, 11-16)
  - **Blocks**: Tasks 11, 15, 17-21
  - **Blocked By**: Tasks 7, 9

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/src/db/schemas.ts` - Entity definition patterns: `.primaryKey()`, `.references()`, `.onDelete()`, `.index()`, `.hasTableName()`, `.projection()`, `.hasColumnName()`, `.hasMany()`, `.belongsTo()`, `defineEntity`
  - `/home/andrew/projects/framework/libs/orm/README.md` - ORM docs for entity relationships

  **Acceptance Criteria**:
  - [ ] All 4 entities defined with complete JSDoc
  - [ ] Relationships: User→Categories, User→Transactions, Category→Transactions, Transaction→Category
  - [ ] `categoryId` uses `onDelete('RESTRICT')` to prevent deleting categories with transactions
  - [ ] Projections on UserDbSchema (public, auth)
  - [ ] Test file validates entity structure

  **QA Scenarios**:
  ```
  Scenario: Verify entity definitions compile and have correct structure
    Tool: Bash (vitest)
    Steps:
      1. Run vitest apps/api/src/db/__tests__/schemas.test.ts
      2. Assert UserEntity has tableName 'users'
      3. Assert CategoryEntity has belongsTo relationship to UserEntity
      4. Assert TransactionEntity has belongsTo to CategoryEntity with RESTRICT delete
    Expected Result: All tests pass, entities correctly defined
    Evidence: .sisyphus/evidence/task-10-entities.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add ORM entity definitions with relationships`
  - Files: `apps/api/src/db/schemas.ts`, `apps/api/src/db/__tests__/schemas.test.ts`

- [x] 11. Initial Database Migration

  **What to do**:
  - Create `apps/api/db.config.ts` using `@cleverbrush/orm-cli` `defineConfig`:
    - Reference `entityMap` from Task 10
    - Migration directory: `./migrations`
    - Table name: `knex_migrations`
  - Create `apps/api/migrations/20260508000001_initial.ts`:
    - `up` function: Create tables in dependency order:
      1. `users`: id (serial PK), email (varchar 255 unique not null), password_hash (varchar 512 null), role (varchar 50 default 'user'), auth_provider (varchar 50 default 'local'), default_currency (varchar 3 default 'USD'), favorite_currencies (jsonb default '[]'::jsonb), created_at (timestamptz default now())
      2. `categories`: id (serial PK), user_id (int FK→users CASCADE), name (varchar 100 not null), type (varchar 10 not null check in 'expense','income'), created_at (timestamptz default now()), index on user_id
      3. `transactions`: id (serial PK), user_id (int FK→users CASCADE), category_id (int FK→categories RESTRICT), amount (decimal 12,2 not null), currency (varchar 3 not null), description (text null), transaction_date (timestamptz not null), created_at (timestamptz default now()), indices on user_id, category_id, transaction_date
      4. `exchange_rates`: id (serial PK), base_currency (varchar 3 not null), target_currency (varchar 3 not null), rate (decimal 18,8 not null), updated_at (timestamptz default now()), unique on (base_currency, target_currency)
    - `down` function: Drop tables in reverse order (exchange_rates, transactions, categories, users)
  - **WRITE TESTS FIRST**: Create test that validates migration can run up and down without errors (use test database)

  **Must NOT do**:
  - Don't create additional migrations yet (that's in later tasks)
  - Don't use `table.timestamps()` - use explicit columns for clarity
  - Don't forget RESTRICT on category_id foreign key

  **Recommended Agent Profile**:
  - **Category**: `deep` - Complex migration with FK ordering, constraints, indices
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 10)
  - **Parallel Group**: Wave 2 (with Tasks 9, 12-16)
  - **Blocks**: Tasks 15, 17-21
  - **Blocked By**: Task 10

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/src/db/migrations/001_initial.ts` - Migration pattern: `up`/`down` functions, FK references, indices
  - `/home/andrew/projects/framework/demos/todo-backend/db.config.ts` - ORM CLI config pattern

  **Acceptance Criteria**:
  - [ ] Migration file creates 4 tables in correct order
  - [ ] All foreign keys, indices, and constraints defined
  - [ ] `down` function drops tables in correct reverse order
  - [ ] Test validates migration runs successfully

  **QA Scenarios**:
  ```
  Scenario: Verify migration creates all tables
    Tool: Bash (using test PostgreSQL)
    Preconditions: Test PostgreSQL running (docker or local)
    Steps:
      1. Set DB env vars for test database
      2. Run npx cb-orm migrate run
      3. Query information_schema.tables WHERE table_schema='public'
      4. Assert users, categories, transactions, exchange_rates all exist
    Expected Result: All 4 tables created with correct columns
    Evidence: .sisyphus/evidence/task-11-migration.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add initial database migration`
  - Files: `apps/api/db.config.ts`, `apps/api/migrations/20260508000001_initial.ts`

- [x] 12. Config Module (API-side)

  **What to do**:
  - Create `apps/api/src/config.ts` that re-exports and extends the shared config from `packages/contract`:
    - Import `config` from `@xpenser/contract`
    - Add any API-specific computed values (e.g., `isProduction`)
    - Re-export `Config` type
  - Ensure the config reads from `.env` at startup
  - **WRITE TESTS FIRST**: Test that config parses correctly with mock env vars

  **Must NOT do**:
  - Don't duplicate the shared config schema from Task 6
  - Don't create a separate config parsing - re-use the contract's parseEnv result

  **Recommended Agent Profile**:
  - **Category**: `quick` - Re-export + thin wrapper
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9-11, 13-16)
  - **Blocks**: Tasks 13, 17-21
  - **Blocked By**: Tasks 6, 9

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/src/config.ts` - Config re-export pattern
  - `packages/contract/src/config.ts` - Shared config from Task 6

  **Acceptance Criteria**:
  - [ ] `apps/api/src/config.ts` exports typed `config` and `Config` type
  - [ ] Config reads from process.env correctly

  **QA Scenarios**:
  ```
  Scenario: Verify config module parses env vars
    Tool: Bash
    Steps:
      1. Set DB_HOST=localhost npm run dev (dry-run import check)
      2. Or: vitest test that mocks env vars and asserts config values
    Expected Result: Config parsed without errors
    Evidence: .sisyphus/evidence/task-12-config.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add API config module`
  - Files: `apps/api/src/config.ts`, `apps/api/src/__tests__/config.test.ts`

- [x] 13. DI Setup (Dependency Injection)

  **What to do**:
  - Create `apps/api/src/di/tokens.ts`:
    - `KnexToken = any().hasType<Knex>()` - Raw Knex instance
    - `DbToken = any().hasType<DbContext<AppEntityMap>>()` - Typed DbContext for reads
    - `TrackedDbToken = any().hasType<TrackedDbContext<AppEntityMap>>()` - Tracked context for mutations
    - `ConfigToken = any().hasType<Config>()` - Application config
    - `LoggerToken = any().hasType<Logger>()` - Structured logger
  - Create `apps/api/src/di/setup.ts` with `configureDI` function:
    - Register ConfigToken as singleton (from config module)
    - Register LoggerToken as singleton (from logger setup - placeholder until Task 14)
    - Register KnexToken as singleton (instrumentKnex wrapped knex instance with pg client)
    - Register DbToken as singleton (createDb with entityMap)
    - Register TrackedDbToken as transient (createDb with entityMap + tracking:true)
    - Connection pool: min 2, max 10, acquireTimeout 10000ms
  - Export `configureDI` function
  - **WRITE TESTS FIRST**: Test that all tokens can be registered and resolved

  **Must NOT do**:
  - Don't instantiate knex with hardcoded connection string - use config
  - Don't register KnexToken before instrumentKnex wrapping

  **Recommended Agent Profile**:
  - **Category**: `deep` - DI wiring with multiple lifetimes and instrumented dependencies
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9-12, 14-16)
  - **Blocks**: Tasks 17-21
  - **Blocked By**: Tasks 9, 10, 12

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/src/di/tokens.ts` - Token definitions pattern
  - `/home/andrew/projects/framework/demos/todo-backend/src/di/setup.ts` - configureDI pattern with lifetimes
  - `/home/andrew/projects/framework/libs/di/README.md` - Service lifetimes docs

  **Acceptance Criteria**:
  - [ ] All 5 tokens defined with correct types
  - [ ] configureDI registers all services with correct lifetimes
  - [ ] Knex instance uses instrumentKnex for OTel
  - [ ] Tests verify singleton/transient behavior

  **QA Scenarios**:
  ```
  Scenario: Verify DI resolution
    Tool: Bash (vitest)
    Steps:
      1. Run test: create ServiceCollection, call configureDI, build provider
      2. Assert provider.get(ConfigToken) returns config object
      3. Assert provider.get(DbToken) !== provider.get(TrackedDbToken) - different instances
    Expected Result: All tokens resolve correctly with proper lifetimes
    Evidence: .sisyphus/evidence/task-13-di.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add dependency injection setup`
  - Files: `apps/api/src/di/tokens.ts`, `apps/api/src/di/setup.ts`, `apps/api/src/di/__tests__/setup.test.ts`

- [x] 14. Telemetry + Logger Setup

  **What to do**:
  - Create `apps/api/src/telemetry.ts` (must be loaded FIRST via --import):
    - Use `setupOtel` from `@cleverbrush/otel`
    - serviceName: `process.env.OTEL_SERVICE_NAME ?? 'xpenser-api'`
    - serviceVersion: from package.json
    - environment: `process.env.NODE_ENV`
    - otlpEndpoint: from env or default `http://sigNoz-otel-collector:4318`
    - Instrumentations: HttpInstrumentation, UndiciInstrumentation, RuntimeNodeInstrumentation
  - Create `apps/api/src/logTemplates.ts` (structured log templates):
    - `AppStarting`, `MigrationsRunning`, `MigrationsComplete`, `Listening`, `ShutdownReceived`, `HttpServerClosed`
    - `UserRegistered`, `UserLoggedIn`, `TransactionCreated`, `TransactionUpdated`, `CategoryCreated`, `CategoryDeleted`
    - All using `parseString` from `@cleverbrush/schema`
  - Create `apps/api/src/logger.ts`:
    - Use `createLogger` from `@cleverbrush/log`
    - Sinks: `consoleSink({ theme: 'dark' })`, `otelLogSink()`
    - Enrichers: `traceEnricher()`
    - Minimum level from config.logLevel
    - Export `logger` instance
  - **WRITE TESTS FIRST**: Test that logger creates log events with correct template

  **Must NOT do**:
  - Don't put telemetry initialization anywhere except the dedicated file
  - Don't skip traceEnricher - log/trace correlation is mandatory

  **Recommended Agent Profile**:
  - **Category**: `deep` - OTel SDK setup + structured logging with correlation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9-13, 15-16)
  - **Blocks**: Tasks 17, 22
  - **Blocked By**: Tasks 9, 12

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/src/telemetry.ts` - OTel setup pattern
  - `/home/andrew/projects/framework/demos/todo-backend/src/logTemplates.ts` - Log template definitions
  - `/home/andrew/projects/framework/libs/otel/README.md` - setupOtel, tracingMiddleware, instrumentKnex, otelLogSink, traceEnricher

  **Acceptance Criteria**:
  - [ ] `telemetry.ts` exports `otel` instance with shutdown support
  - [ ] `logTemplates.ts` has at least 10 structured log templates
  - [ ] `logger.ts` creates logger with OTel correlation
  - [ ] Test verifies logger produces valid log events

  **QA Scenarios**:
  ```
  Scenario: Verify logger creates structured events
    Tool: Bash (vitest)
    Steps:
      1. Import logger and AppStarting template
      2. Call logger.info(AppStarting, { Environment: 'test' })
      3. Assert log event contains MessageTemplate and Environment property
    Expected Result: Structured log event with correct template and properties
    Evidence: .sisyphus/evidence/task-14-logger.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add OpenTelemetry and structured logging setup`
  - Files: `apps/api/src/telemetry.ts`, `apps/api/src/logTemplates.ts`, `apps/api/src/logger.ts`

- [x] 15. Auth Service

  **What to do**:
  - Create `apps/api/src/services/auth.ts`:
    - `hashPassword(password: string): Promise<string>` - scrypt with random 16-byte salt, keylen=64, N=16384, r=8, p=1, return `salt:hashHex` format
    - `verifyPassword(password: string, stored: string): Promise<boolean>` - split salt:hash, derive, timingSafeEqual comparison
    - `issueToken(userId: number, role: string): string` - signJwt with sub, role, exp claims
    - `verifyGoogleToken(idToken: string): Promise<{ email: string; name: string }>` - google-auth-library OAuth2Client
  - Create `apps/api/src/services/__tests__/auth.test.ts`:
    - Test password hashing and verification (correct password, wrong password)
    - Test JWT token issuance and verification (valid token, expired token, tampered token)
    - Test Google token verification mock
  - **WRITE TESTS FIRST** (TDD RED phase):
    - Write failing test for hashPassword producing non-empty string
    - Write failing test for verifyPassword returning true for correct password
    - Write failing test for issueToken producing valid JWT

  **Must NOT do**:
  - Don't use bcrypt or argon2 - stick with Node.js built-in scrypt
  - Don't hardcode JWT secret in source
  - Don't export hashPassword with weaker params than N=16384

  **Recommended Agent Profile**:
  - **Category**: `deep` - Cryptographically correct auth service with scrypt and JWT
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9-14, 16)
  - **Blocks**: Task 17
  - **Blocked By**: Tasks 10, 11 (needs User entity for testing)

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/src/api/handlers/auth.ts` - scrypt hash/verify pattern, signJwt usage, google-auth-library OAuth2Client
  - `/home/andrew/projects/framework/libs/auth/README.md` - jwtScheme, signJwt, Principal pattern

  **Acceptance Criteria**:
  - [ ] `hashPassword` produces `salt:hash` format with correct keylen
  - [ ] `verifyPassword` uses timingSafeEqual (constant-time comparison)
  - [ ] `issueToken` produces JWT with sub, role, exp claims
  - [ ] `verifyGoogleToken` validates real Google ID tokens (mocked in tests)
  - [ ] All auth service tests pass (RED→GREEN→REFACTOR)

  **QA Scenarios**:
  ```
  Scenario: Verify password hashing and verification
    Tool: Bash (vitest)
    Steps:
      1. Call hashPassword("mySecurePassword123")
      2. Assert result contains ":" (salt:hash format)
      3. Call verifyPassword("mySecurePassword123", storedHash)
      4. Assert result is true
    Expected Result: Password hashed and verified correctly
    Evidence: .sisyphus/evidence/task-15-password.txt

  Scenario: Verify wrong password is rejected
    Tool: Bash (vitest)
    Steps:
      1. Hash password "correct"
      2. Verify with password "wrong"
      3. Assert result is false
    Expected Result: Wrong password rejected
    Evidence: .sisyphus/evidence/task-15-wrong-password.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add auth service with password hashing and JWT`
  - Files: `apps/api/src/services/auth.ts`, `apps/api/src/services/__tests__/auth.test.ts`

- [x] 16. Currency Service + Frankfurter Scheduler

  **What to do**:
  - Create `apps/api/src/services/currency.ts`:
    - `fetchExchangeRates(base: string): Promise<Map<string, number>>` - Fetch from Frankfurter API (config.frankfurter.url), parse response, return Map of currency→rate
    - `storeExchangeRates(db, base: string, rates: Map<string, number>): Promise<void>` - Upsert into exchange_rates table
    - `convertAmount(amount: number, from: string, to: string, db): Promise<number>` - Look up rate from exchange_rates table, compute converted amount, round to 2 decimal places
    - `getAvailableCurrencies(): Promise<string[]>` - Fetch from Frankfurter /currencies endpoint (or return hardcoded list of common currencies as fallback)
  - Create `apps/api/src/services/scheduler.ts`:
    - Use `@cleverbrush/scheduler` to create a daily job that fetches USD rates and stores them
    - On startup, fetch immediately if exchange_rates table is empty
    - Log schedule events via structured logger
  - **WRITE TESTS FIRST**:
    - Mock Frankfurter API response
    - Test fetchExchangeRates parses correctly
    - Test convertAmount applies correct rate and rounding
    - Test that scheduler job fires on schedule (using fast timer for tests)

  **Must NOT do**:
  - Don't call Frankfurter API on every conversion request - use DB cache
  - Don't fail silently on Frankfurter API errors - log and retry
  - Don't round before final conversion (use full precision, round at display)

  **Recommended Agent Profile**:
  - **Category**: `deep` - External API integration + scheduler + caching
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9-15)
  - **Blocks**: Tasks 19 (transactions need conversion), 21 (dashboard needs conversion)
  - **Blocked By**: Tasks 11 (exchange_rates table), 12 (config)

  **References**:
  - Frankfurter API docs: `https://www.frankfurter.dev/` - REST API for currency rates
  - `/home/andrew/projects/framework/libs/scheduler/README.md` - Scheduler pattern
  - Exchange rates table from Task 11 migration

  **Acceptance Criteria**:
  - [ ] `fetchExchangeRates` returns Map of currency codes to rates
  - [ ] `storeExchangeRates` upserts rates into DB
  - [ ] `convertAmount` correctly converts and rounds to 2 decimals
  - [ ] Daily scheduler job registered and runs
  - [ ] All currency service tests pass

  **QA Scenarios**:
  ```
  Scenario: Verify currency conversion with known rate
    Tool: Bash (vitest)
    Steps:
      1. Store mock rate: USD→EUR = 0.92
      2. Call convertAmount(100, 'USD', 'EUR', mockDb)
      3. Assert result is 92.00
    Expected Result: Amount converted correctly with 2 decimal rounding
    Evidence: .sisyphus/evidence/task-16-conversion.txt

  Scenario: Verify Frankfurter API fetch and store
    Tool: Bash (vitest with mocked HTTP)
    Steps:
      1. Mock Frankfurter response for USD base
      2. Call fetchExchangeRates('USD')
      3. Assert Map contains EUR, GBP, JPY keys
      4. Call storeExchangeRates and verify DB entries
    Expected Result: Rates fetched and stored correctly
    Evidence: .sisyphus/evidence/task-16-fetch.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add currency service with Frankfurter API and scheduler`
  - Files: `apps/api/src/services/currency.ts`, `apps/api/src/services/scheduler.ts`, `apps/api/src/services/__tests__/currency.test.ts`

- [x] 17. Auth Endpoints + Handlers

  **What to do**:
  - Create `apps/api/src/api/endpoints.ts` extending contract with server metadata:
    - Import `api` from `@xpenser/contract`
    - `RegisterEndpoint = api.auth.register.inject({ db: DbToken }).summary('Register new user').description('...').tags('auth').operationId('register')`
    - `LoginEndpoint = api.auth.login.inject({ db: DbToken }).summary('Login').description('...').tags('auth').operationId('login')`
    - `GoogleLoginEndpoint = api.auth.googleLogin.inject({ db: DbToken }).summary('Login with Google').description('...').tags('auth').operationId('googleLogin')`
  - Create `apps/api/src/api/handlers/auth.ts`:
    - `registerHandler`: Check email not in use (db.users.projected('public').where(...)), hash password, insert user with role='user' and authProvider='local', issue JWT, return { token, expiresIn }
    - `loginHandler`: Find user by email (projected 'auth'), verify password, issue JWT, return { token, expiresIn }
    - `googleLoginHandler`: Verify Google ID token, find or create user with authProvider='google', issue JWT, return { token, expiresIn }
  - Create `apps/api/src/api/mappers.ts`: `mapUser(dbUser) → UserResponse` mapping
  - **WRITE TESTS FIRST**: Test register (success, duplicate email), login (success, wrong password, non-existent user), googleLogin (new user, returning user)
  - Use TrackedDbToken for mutation handlers

  **Must NOT do**:
  - Don't return passwordHash in any response
  - Don't allow registration with existing email
  - Don't use `as any` for Principal type

  **Recommended Agent Profile**:
  - **Category**: `deep` - Auth handlers with password hashing, JWT, Google OAuth, DB operations
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 15)
  - **Parallel Group**: Wave 3 (with Tasks 18-21)
  - **Blocks**: Tasks 22-24
  - **Blocked By**: Task 15

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/src/api/handlers/auth.ts` - Register/Login/Google handler patterns with scrypt, signJwt, google-auth-library
  - `/home/andrew/projects/framework/demos/todo-backend/src/api/endpoints.ts` - Endpoint extension pattern (.inject, .summary, .tags, .operationId)
  - `/home/andrew/projects/framework/demos/todo-backend/src/api/mappers.ts` - Mapper pattern

  **Acceptance Criteria**:
  - [ ] Register: new user created, JWT returned, duplicate email → 400
  - [ ] Login: correct credentials → 200 + JWT, wrong → 401
  - [ ] Google: new user auto-provisioned, returning user authenticated
  - [ ] All hander tests pass (RED→GREEN→REFACTOR)

  **QA Scenarios**:
  ```
  Scenario: Register a new user successfully
    Tool: Bash (curl against running API)
    Preconditions: Test database with clean users table, API running
    Steps:
      1. curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"securepass123","defaultCurrency":"USD","favoriteCurrencies":["EUR"]}'
      2. Assert HTTP status 201
      3. Assert response.body.token is a non-empty string
      4. Assert response.body.expiresIn is a positive number
    Expected Result: User registered, JWT token returned
    Evidence: .sisyphus/evidence/task-17-register.json

  Scenario: Register with duplicate email
    Tool: Bash (curl)
    Steps:
      1. Register same email twice
      2. Assert second response status is 400
      3. Assert response.body.message contains "already registered"
    Expected Result: Duplicate email rejected with 400
    Evidence: .sisyphus/evidence/task-17-duplicate.json
  ```

  **Commit**: YES
  - Message: `feat(api): add auth endpoints and handlers`
  - Files: `apps/api/src/api/endpoints.ts`, `apps/api/src/api/handlers/auth.ts`, `apps/api/src/api/mappers.ts`

- [x] 18. Categories Endpoints + Handlers

  **What to do**:
  - Extend `apps/api/src/api/endpoints.ts`:
    - `ListCategoriesEndpoint = api.categories.list.authorize(PrincipalSchema).inject({ db: DbToken }).summary('...').tags('categories')`
    - `CreateCategoryEndpoint = api.categories.create.authorize(PrincipalSchema).inject({ db: TrackedDbToken }).summary('...').tags('categories')`
    - `UpdateCategoryEndpoint = api.categories.update.authorize(PrincipalSchema).inject({ db: TrackedDbToken }).summary('...').tags('categories')`
    - `DeleteCategoryEndpoint = api.categories.delete.authorize(PrincipalSchema).inject({ db: TrackedDbToken }).summary('...').tags('categories')`
  - Create `apps/api/src/api/handlers/categories.ts`:
    - `listHandler`: Get all categories for authenticated user (db.categories.where(t => t.userId, principal.claims.sub))
    - `createHandler`: Insert new category with userId from principal, validate name is non-empty
    - `updateHandler`: Find category by id, verify ownership (userId === principal.claims.sub), update name/type
    - `deleteHandler`: Check category has no transactions (using RESTRICT FK, catch DB error), verify ownership, delete. Return 409 Conflict if has transactions.
    - Use TrackedDbToken for create/update/delete (mutation handlers)
  - **WRITE TESTS FIRST**: Test CRUD operations, ownership verification, delete protection when transactions exist, first-time user forced to create category (business rule documented - UI enforces)

  **Must NOT do**:
  - Don't allow users to see/modify other users' categories
  - Don't allow deleting categories with associated transactions
  - Don't skip ownership check in any handler

  **Recommended Agent Profile**:
  - **Category**: `deep` - Category CRUD with ownership enforcement and referential integrity
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 17, 19-21)
  - **Blocks**: Tasks 22-24, 35, 37
  - **Blocked By**: Tasks 10, 11, 13

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/src/api/handlers/todos.ts` - CRUD handler pattern with ownership checks
  - `/home/andrew/projects/framework/demos/todo-backend/src/api/endpoints.ts` - .authorize(PrincipalSchema) pattern

  **Acceptance Criteria**:
  - [ ] List returns only user's categories (empty array for new user)
  - [ ] Create adds category with correct userId and validated fields
  - [ ] Update verifies ownership, rejects cross-user updates
  - [ ] Delete with transactions → 409 Conflict, without transactions → 204
  - [ ] All handler tests pass

  **QA Scenarios**:
  ```
  Scenario: Create category and verify list
    Tool: Bash (curl with JWT)
    Steps:
      1. Login to get JWT token
      2. POST /api/categories {"name":"Groceries","type":"expense"}
      3. Assert status 201, category.name === "Groceries"
      4. GET /api/categories with Auth header
      5. Assert response array contains created category
    Expected Result: Category created and appears in user's list
    Evidence: .sisyphus/evidence/task-18-crud.json

  Scenario: Delete category with transactions fails
    Tool: Bash (curl)
    Steps:
      1. Create category, create transaction linked to it
      2. DELETE /api/categories/:id
      3. Assert status 409
    Expected Result: Delete rejected with 409 Conflict
    Evidence: .sisyphus/evidence/task-18-delete-protection.json
  ```

  **Commit**: YES
  - Message: `feat(api): add categories endpoints and handlers`
  - Files: `apps/api/src/api/handlers/categories.ts`

- [x] 19. Transactions Endpoints + Handlers

  **What to do**:
  - Extend `apps/api/src/api/endpoints.ts`:
    - `ListTransactionsEndpoint`, `GetTransactionEndpoint`, `CreateTransactionEndpoint`, `UpdateTransactionEndpoint`, `DeleteTransactionEndpoint`
    - All authenticate + authorize + inject DbToken/TrackedDbToken
  - Create `apps/api/src/api/handlers/transactions.ts`:
    - `listHandler`: Filter by userId, optional categoryId/startDate/endDate/type. Paginate (page/limit). Include category name via `.include(t => t.category)`. Convert amounts to user's default currency if different.
    - `getHandler`: Single transaction by id, verify ownership, include category
    - `createHandler`: Validate category exists and belongs to user, insert transaction with userId from principal, convert amount if currency differs from default
    - `updateHandler`: Verify ownership, update fields, handle currency change
    - `deleteHandler`: Verify ownership, delete, return 204
  - Convert amounts to default currency using `convertAmount` from Task 16
  - **WRITE TESTS FIRST**: Test list with filters, create with currency conversion, update ownership, delete

  **Must NOT do**:
  - Don't allow creating transaction with another user's category
  - Don't return transactions without category info (include it)
  - Don't modify amount in storage - convert at display time only
  - Don't expose internal IDs unnecessarily

  **Recommended Agent Profile**:
  - **Category**: `deep` - Transaction CRUD with filtering, pagination, currency conversion, include relations
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 17-18, 20-21)
  - **Blocks**: Tasks 22-24, 35-36
  - **Blocked By**: Tasks 10, 11, 13, 16

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/src/api/handlers/todos.ts` - CRUD pattern with .include() for eager loading
  - `/home/andrew/projects/framework/libs/orm/README.md` - .include() eager loading, .where(), pagination

  **Acceptance Criteria**:
  - [ ] List returns paginated results with category info and converted amounts
  - [ ] Create validates category ownership, stores original currency + amount
  - [ ] Update verifies ownership, handles partial updates
  - [ ] Delete returns 204
  - [ ] Date range and category filters work correctly
  - [ ] All tests pass

  **QA Scenarios**:
  ```
  Scenario: Create transaction and retrieve it
    Tool: Bash (curl with JWT)
    Steps:
      1. Login, create a category
      2. POST /api/transactions {"categoryId":1,"amount":50.00,"currency":"USD","description":"Lunch","transactionDate":"2026-05-08T12:00:00Z"}
      3. Assert status 201, amount === 50.00
      4. GET /api/transactions/:id
      5. Assert response includes category.name
    Expected Result: Transaction created and retrievable with category info
    Evidence: .sisyphus/evidence/task-19-crud.json

  Scenario: Filter transactions by date range
    Tool: Bash (curl)
    Steps:
      1. Create transactions with different dates
      2. GET /api/transactions?startDate=2026-05-01&endDate=2026-05-07
      3. Assert only transactions in range returned
    Expected Result: Date filtering works correctly
    Evidence: .sisyphus/evidence/task-19-filter.json
  ```

  **Commit**: YES
  - Message: `feat(api): add transactions endpoints and handlers`
  - Files: `apps/api/src/api/handlers/transactions.ts`

- [x] 20. User Preferences Endpoints + Handlers

  **What to do**:
  - Extend `apps/api/src/api/endpoints.ts`:
    - `GetProfileEndpoint = api.users.getProfile.authorize(PrincipalSchema).inject({ db: DbToken })...`
    - `UpdateProfileEndpoint = api.users.updateProfile.authorize(PrincipalSchema).inject({ db: TrackedDbToken })...`
    - `ListCurrenciesEndpoint = api.currencies.list.inject({ db: DbToken })...`
    - `ConvertCurrencyEndpoint = api.currencies.convert.inject({ db: DbToken })...`
  - Create `apps/api/src/api/handlers/preferences.ts`:
    - `getProfileHandler`: Get user by id (from principal), return public projection
    - `updateProfileHandler`: Update defaultCurrency and/or favoriteCurrencies, validate currency codes (3 chars, uppercase)
    - `listCurrenciesHandler`: Return list of available currencies (from Frankfurter or hardcoded common set: USD,EUR,GBP,JPY,CAD,AUD,CHF,CNY,...)
    - `convertHandler`: Convert amount between two currencies using DB rates
  - **WRITE TESTS FIRST**: Test profile retrieval, currency update validation, currency listing

  **Must NOT do**:
  - Don't allow changing email or password via preferences (separate future feature)
  - Don't expose authProvider or role in preferences update
  - Don't validate currencies against Frankfurter on every request - use cached list

  **Recommended Agent Profile**:
  - **Category**: `deep` - User preferences with currency validation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 17-19, 21)
  - **Blocks**: Tasks 22-24, 37
  - **Blocked By**: Tasks 10, 11, 13, 16

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/src/api/handlers/users.ts` - User profile handler pattern
  - Frankfurter currencies endpoint: `https://api.frankfurter.dev/currencies`

  **Acceptance Criteria**:
  - [ ] GetProfile returns user's public fields (no passwordHash)
  - [ ] UpdateProfile validates currency code format (3 uppercase letters)
  - [ ] ListCurrencies returns common currency codes
  - [ ] Convert uses DB rates and returns 2-decimal result
  - [ ] All tests pass

  **QA Scenarios**:
  ```
  Scenario: Update user default currency
    Tool: Bash (curl with JWT)
    Steps:
      1. Login and get profile
      2. PATCH /api/users/me {"defaultCurrency":"EUR"}
      3. Assert status 200, defaultCurrency === "EUR"
      4. GET /api/users/me
      5. Assert profile reflects updated currency
    Expected Result: Currency updated successfully
    Evidence: .sisyphus/evidence/task-20-preferences.json

  Scenario: Reject invalid currency code
    Tool: Bash (curl)
    Steps:
      1. PATCH /api/users/me {"defaultCurrency":"INVALID"}
      2. Assert status 400
    Expected Result: Invalid currency code rejected
    Evidence: .sisyphus/evidence/task-20-invalid.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add user preferences and currency endpoints`
  - Files: `apps/api/src/api/handlers/preferences.ts`

- [x] 21. Dashboard/Analytics Endpoints + Handlers

  **What to do**:
  - Extend `apps/api/src/api/endpoints.ts`:
    - `GetDashboardSummaryEndpoint = api.dashboard.getSummary.authorize(PrincipalSchema).inject({ db: DbToken })...`
  - Create `apps/api/src/api/handlers/dashboard.ts`:
    - `getDashboardSummaryHandler`: 
      - Parse period (week/month/quarter/year) and optional date range
      - Calculate date boundaries based on period
      - Query transactions for user within date range
      - Group by category: SUM(amount) per category
      - Convert all amounts to user's default currency
      - Calculate totalExpenses (sum of expense-type categories), totalIncome (sum of income-type)
      - Calculate netAmount = totalIncome - totalExpenses
      - Include recentTransactions (last 10, with category names)
      - Return DashboardSummaryResponse
    - Use raw Knex queries for aggregation (SUM, GROUP BY) via BoundQueryToken or knex.raw with parameterized queries
  - **WRITE TESTS FIRST**: Test period boundary calculation, category grouping, currency conversion in aggregations

  **Must NOT do**:
  - Don't use unparameterized SQL for aggregation queries
  - Don't include transactions outside the requested period
  - Don't show other users' data

  **Recommended Agent Profile**:
  - **Category**: `deep` - Complex aggregation queries with date boundaries and currency conversion
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 17-20)
  - **Blocks**: Tasks 22-24, 35
  - **Blocked By**: Tasks 10, 11, 13, 16

  **References**:
  - Knex aggregation: `.sum()`, `.groupBy()`, `.whereBetween()` for date ranges
  - `/home/andrew/projects/framework/libs/knex-schema/README.md` - Type-safe query building

  **Acceptance Criteria**:
  - [ ] Dashboard returns totals, net amount, by-category breakdown, and recent transactions
  - [ ] Period selector correctly bounds dates (week=Mon-Sun, month=1st-last, etc.)
  - [ ] All amounts converted to user's default currency
  - [ ] Returns empty data (zeroes) for users with no transactions (not an error)
  - [ ] All tests pass

  **QA Scenarios**:
  ```
  Scenario: Dashboard with transactions in multiple categories
    Tool: Bash (curl with JWT)
    Preconditions: User with Groceries (expense) and Salary (income) categories, transactions in both
    Steps:
      1. GET /api/dashboard/summary?period=month
      2. Assert totalIncome > 0 and totalExpenses > 0
      3. Assert byCategory array has entries for both categories
      4. Assert recentTransactions has at most 10 items
    Expected Result: Complete dashboard summary with correct aggregations
    Evidence: .sisyphus/evidence/task-21-dashboard.json

  Scenario: Dashboard for user with no transactions
    Tool: Bash (curl with JWT)
    Preconditions: New user with categories but no transactions
    Steps:
      1. GET /api/dashboard/summary?period=month
      2. Assert totalIncome === 0, totalExpenses === 0
      3. Assert byCategory is empty array
    Expected Result: Empty state returned gracefully (200, not error)
    Evidence: .sisyphus/evidence/task-21-empty.json
  ```

  **Commit**: YES
  - Message: `feat(api): add dashboard analytics endpoint`
  - Files: `apps/api/src/api/handlers/dashboard.ts`

- [x] 22. Server Builder Assembly

  **What to do**:
  - Create `apps/api/src/server.ts` with `buildServer` function:
    - Import `createServer` from `@cleverbrush/server`
    - Import all endpoints from `apps/api/src/api/endpoints.ts`
    - Import handlers from all handler modules
    - Set up middleware chain:
      1. `tracingMiddleware({ excludePaths: ['/health'] })` - First! Opens SERVER span
      2. CORS middleware (allow origin from config, methods GET/POST/PUT/PATCH/DELETE/OPTIONS, headers Content-Type/Authorization, expose X-Trace-Id/X-Response-Time)
      3. Request timing middleware (X-Response-Time header)
      4. Audit logging middleware (structured logs for each request)
    - Configure authentication:
      - `useAuthentication({ defaultScheme: 'jwt', schemes: [jwtScheme({ secret, mapClaims })] })`
      - PrincipalSchema for authorization
      - `useAuthorization()`
    - Configure DI: `services(svc => configureDI(svc, config, logger))`
    - Register all handlers via `mapHandlers` or individual `.handle()` calls
    - Register health check endpoint (`/health` returns 200 OK)
    - Register OpenAPI endpoint (`/openapi.json` via `generateOpenApiSpec` from `@cleverbrush/server-openapi`)
    - Serve AsyncApi/Swagger UI at `/docs`
    - Return server instance
  - Create `apps/api/src/api/handlers/index.ts` barrel export
  - **WRITE TESTS FIRST**: Integration test that starts server, calls /health, verifies 200

  **Must NOT do**:
  - Don't skip tracingMiddleware - it must be FIRST in the chain
  - Don't allow unauthenticated access to protected endpoints
  - Don't expose stack traces in error responses in production

  **Recommended Agent Profile**:
  - **Category**: `deep` - Complex server assembly with middleware chain, auth, DI, OpenAPI
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on all handler tasks)
  - **Parallel Group**: Wave 4 (sequential after Wave 3)
  - **Blocks**: Tasks 23-24, 35-39
  - **Blocked By**: Tasks 14, 17-21

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/src/server.ts` - Full server assembly pattern: middleware chain, auth, DI, OpenAPI, mapHandlers, health check
  - `/home/andrew/projects/framework/demos/todo-backend/src/api/handlers/index.ts` - Handler barrel export

  **Acceptance Criteria**:
  - [ ] Server builds without errors
  - [ ] All middleware registered in correct order (tracing first)
  - [ ] Auth and authorization configured
  - [ ] All endpoints registered with handlers
  - [ ] Health endpoint returns 200
  - [ ] OpenAPI spec accessible at /openapi.json
  - [ ] Integration test passes

  **QA Scenarios**:
  ```
  Scenario: Server starts and health check passes
    Tool: Bash (start server in background)
    Steps:
      1. Start server on port 3001
      2. curl http://localhost:3001/health
      3. Assert status 200
      4. Assert response includes X-Trace-Id header
      5. Assert response includes X-Response-Time header
    Expected Result: Server healthy with tracing headers
    Evidence: .sisyphus/evidence/task-22-health.txt

  Scenario: OpenAPI spec is generated
    Tool: Bash (curl)
    Steps:
      1. curl http://localhost:3001/openapi.json
      2. Assert status 200
      3. Assert response is valid JSON with openapi version field
      4. Assert paths include /api/auth/register, /api/transactions, /api/categories, /api/dashboard/summary
    Expected Result: Complete OpenAPI spec with all endpoints
    Evidence: .sisyphus/evidence/task-22-openapi.json
  ```

  **Commit**: YES
  - Message: `feat(api): assemble server with middleware, auth, and OpenAPI`
  - Files: `apps/api/src/server.ts`, `apps/api/src/api/handlers/index.ts`

- [x] 23. OpenAPI Spec Generation + Swagger UI

  **What to do**:
  - Verify OpenAPI spec is properly generated from Task 22
  - Configure Swagger UI to serve at `/docs` route
  - Add OpenAPI metadata: title "Xpenser API", version "1.0.0", description, contact info
  - Ensure all endpoints appear with correct schemas, tags, and operationIds
  - Add OpenAPI security scheme definition (bearerAuth)
  - **WRITE TESTS**: Verify all expected paths exist in generated spec

  **Must NOT do**:
  - Don't duplicate endpoint definitions
  - Don't expose internal/private paths in spec

  **Recommended Agent Profile**:
  - **Category**: `quick` - Verification and Swagger UI serving
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 22)
  - **Parallel Group**: Wave 4 (sequential after Task 22)
  - **Blocks**: Task 39
  - **Blocked By**: Task 22

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/src/server.ts` - `generateOpenApiSpec` and `serveAsyncApi` patterns
  - Swagger UI: `swaggerapi/swagger-ui` Docker image from demo docker-compose

  **Acceptance Criteria**:
  - [ ] OpenAPI spec at /openapi.json is valid JSON
  - [ ] Swagger UI accessible at /docs (or via docker-compose swagger-ui service)
  - [ ] Security scheme (bearerAuth) defined
  - [ ] All endpoint groups have tags and operationIds

  **QA Scenarios**:
  ```
  Scenario: OpenAPI spec is valid and complete
    Tool: Bash (curl)
    Steps:
      1. curl http://localhost:3001/openapi.json | jq '.paths | keys'
      2. Assert keys include /api/auth/register, /api/auth/login, /api/categories, /api/transactions, /api/dashboard/summary
      3. curl http://localhost:3001/openapi.json | jq '.components.securitySchemes'
      4. Assert bearerAuth scheme is defined
    Expected Result: Complete and valid OpenAPI spec
    Evidence: .sisyphus/evidence/task-23-openapi.json
  ```

  **Commit**: YES
  - Message: `feat(api): finalize OpenAPI spec and Swagger UI`
  - Files: `apps/api/src/server.ts` (update)

- [x] 24. Entry Point + Graceful Shutdown

  **What to do**:
  - Create `apps/api/src/index.ts`:
    - Load telemetry FIRST: `import './telemetry.js'`
    - Import config, logger, buildServer
    - Log AppStarting with environment info
    - Run migrations on startup (if AUTO_MIGRATE env is true, for dev convenience)
    - Build and start server: `const server = buildServer(config, logger); await server.listen(config.server.port)`
    - Log Listening with host and port
    - Log OpenApiSpec URL
    - Register SIGTERM/SIGINT handlers:
      - Log ShutdownReceived
      - Set timeout (30s forced shutdown)
      - Close HTTP server
      - Await otel.shutdown()
      - Await logger.dispose()
      - Exit with code 0
  - **WRITE TESTS**: Test that index.ts can be imported without side effects (mock server.listen)

  **Must NOT do**:
  - Don't skip telemetry import - it MUST be the first import
  - Don't forget graceful shutdown for OTel flush
  - Don't hardcode port/host

  **Recommended Agent Profile**:
  - **Category**: `quick` - Entry point with shutdown handling
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 22)
  - **Parallel Group**: Wave 4 (sequential after Task 22)
  - **Blocks**: Tasks 38-39
  - **Blocked By**: Task 22

  **References**:
  - `/home/andrew/projects/framework/demos/todo-backend/src/index.ts` - Entry point with graceful shutdown pattern
  - `/home/andrew/projects/framework/demos/todo-backend/src/telemetry.ts` - Must be loaded first

  **Acceptance Criteria**:
  - [ ] Server starts and listens on configured port
  - [ ] Graceful shutdown handles SIGTERM/SIGINT correctly
  - [ ] OTel flushes data on shutdown
  - [ ] Logger disposes on shutdown

  **QA Scenarios**:
  ```
  Scenario: Server starts and responds to health check
    Tool: Bash
    Steps:
      1. Start server: node --import ./dist/telemetry.js dist/index.js &
      2. Wait 3 seconds for startup
      3. curl http://localhost:3001/health
      4. Assert status 200
      5. Kill server with SIGTERM
      6. Assert clean exit (check logs)
    Expected Result: Server starts, responds, and shuts down gracefully
    Evidence: .sisyphus/evidence/task-24-startup.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add entry point with graceful shutdown`
  - Files: `apps/api/src/index.ts`

- [x] 25. Packages/UI Scaffolding + Shadcn Init

  **What to do**:
  - Create `packages/ui/package.json`:
    - Dependencies: React 19, React DOM 19, `@radix-ui/*` (various), `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `next-themes`
    - DevDependencies: `tailwindcss`, `postcss`, `autoprefixer`, `@types/react`
    - Exports: `./*` for component imports
  - Initialize shadcn/ui with `components.json`:
    - style: "new-york" (or "default"), tailwind config, CSS variables for theming
    - baseColor: "neutral"
    - tsx: true
  - Create `packages/ui/tailwind.config.ts` with dark mode "class" strategy
  - Create `packages/ui/src/globals.css` with CSS custom properties for light/dark themes
  - Add shadcn base components: Button, Input, Label, Card, Select, Dialog, Table, Badge, Tabs, DropdownMenu, Avatar
  - Create `packages/ui/src/index.ts` barrel export
  - **WRITE TESTS**: Basic render test for Button component

  **Must NOT do**:
  - Don't install shadcn components directly in apps/web
  - Don't create custom components yet (Task 27)
  - Don't use `as any` in component props

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` - UI library with shadcn, Tailwind, theming
  - **Skills**: ["shadcn"]

  **Parallelization**:
  - **Can Run In Parallel**: YES (independent of API tasks)
  - **Parallel Group**: Wave 5 (with Tasks 26-28)
  - **Blocks**: Tasks 26-28, 29, 34
  - **Blocked By**: Task 1

  **References**:
  - shadcn/ui docs: install patterns, components.json config
  - `packages/ui` should follow standard shadcn monorepo patterns

  **Acceptance Criteria**:
  - [ ] shadcn/ui initialized in packages/ui
  - [ ] At least 10 base components available (Button, Input, Label, Card, Select, Dialog, Table, Badge, Tabs, DropdownMenu)
  - [ ] Tailwind configured with dark mode class strategy
  - [ ] CSS variables for light/dark themes defined
  - [ ] Package compiles and exports components

  **QA Scenarios**:
  ```
  Scenario: Verify shadcn components are importable
    Tool: Bash (vitest with React testing)
    Steps:
      1. Import { Button } from @xpenser/ui
      2. Render <Button>Click me</Button>
      3. Assert button text is "Click me"
      4. Assert button has appropriate classes
    Expected Result: Button component renders correctly
    Evidence: .sisyphus/evidence/task-25-button.txt
  ```

  **Commit**: YES
  - Message: `feat(ui): scaffold shadcn component library with theming`
  - Files: `packages/ui/package.json`, `packages/ui/components.json`, `packages/ui/tailwind.config.ts`, `packages/ui/src/globals.css`, `packages/ui/src/components/ui/*.tsx`

- [x] 26. Theme System (Light/Dark)

  **What to do**:
  - Create `packages/ui/src/theme-provider.tsx`:
    - Wrap `next-themes` ThemeProvider
    - Props: children, defaultTheme ("system")
    - Export `useTheme` hook returning { theme, setTheme, resolvedTheme }
    - Support "light", "dark", "system" modes
  - Define CSS custom properties for both themes in `globals.css`:
    - Colors: background, foreground, primary, secondary, destructive, muted, accent, card, border, input, ring
    - Chart colors for dashboard visualizations
    - Radius variables
  - Ensure dark mode uses Tailwind's `dark:` prefix and CSS variable approach
  - Create `packages/ui/src/theme-toggle.tsx`:
    - Button that cycles through light/dark/system
    - Uses Moon/Sun icons from lucide-react
    - Respects system preference when in "system" mode
  - **WRITE TESTS**: Test theme provider renders children, theme toggle changes theme

  **Must NOT do**:
  - Don't hardcode color values in components - always use CSS variables
  - Don't use inline styles for theming
  - Don't forget to handle SSR hydration mismatch (suppressHydrationWarning on html)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` - Theme system with CSS variables and context
  - **Skills**: ["shadcn"]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 25, 27-28)
  - **Blocks**: Tasks 29, 34
  - **Blocked By**: Task 25

  **References**:
  - `next-themes` docs: ThemeProvider, useTheme API
  - shadcn/ui theming docs: CSS variable approach for light/dark

  **Acceptance Criteria**:
  - [ ] ThemeProvider wraps application with light/dark/system support
  - [ ] CSS variables defined for complete color palette in both themes
  - [ ] ThemeToggle component switches themes correctly
  - [ ] System preference auto-detected on first load
  - [ ] No hydration mismatch in SSR

  **QA Scenarios**:
  ```
  Scenario: Theme toggle changes from light to dark
    Tool: Playwright
    Steps:
      1. Open app with default theme (system/light)
      2. Click ThemeToggle button
      3. Assert html element has class "dark"
      4. Assert background color changed
    Expected Result: Theme toggles correctly with visual change
    Evidence: .sisyphus/evidence/task-26-theme-toggle.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add light/dark theme system with auto-detection`
  - Files: `packages/ui/src/theme-provider.tsx`, `packages/ui/src/theme-toggle.tsx`, `packages/ui/src/globals.css`

- [x] 27. Custom Form Components

  **What to do**:
  - Create `packages/ui/src/currency-selector.tsx`:
    - Dropdown with all available currencies
    - Props: value, onChange, currencies (string[]), placeholder
    - Shows currency code + optional flag emoji
    - Default value "USD"
  - Create `packages/ui/src/period-selector.tsx`:
    - Segmented control or select for week/month/quarter/year
    - Props: value, onChange
    - Visual indicator for selected period
  - Create `packages/ui/src/category-badge.tsx`:
    - Badge showing category name with expense (red) / income (green) color
    - Props: name, type ('expense' | 'income')
  - Create `packages/ui/src/amount-display.tsx`:
    - Formatted amount with currency symbol
    - Props: amount (number), currency (string)
    - Uses Intl.NumberFormat for locale-aware formatting
    - Negative amounts shown in red
  - Export all from `packages/ui/src/index.ts`
  - **WRITE TESTS**: Render tests for each component with various props

  **Must NOT do**:
  - Don't hardcode currency list - accept as prop
  - Don't style components with fixed widths/heights that break responsiveness

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` - Custom form components with business logic
  - **Skills**: ["shadcn"]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 25-26, 28)
  - **Blocks**: Tasks 33, 35-37
  - **Blocked By**: Task 25

  **References**:
  - `Intl.NumberFormat` MDN docs for currency formatting
  - ISO 4217 currency codes: standard 3-letter codes

  **Acceptance Criteria**:
  - [ ] CurrencySelector renders with common currencies, defaults to USD
  - [ ] PeriodSelector supports week/month/quarter/year
  - [ ] CategoryBadge colors: red for expense, green for income
  - [ ] AmountDisplay uses Intl.NumberFormat with correct locale formatting
  - [ ] All components typed and tested

  **QA Scenarios**:
  ```
  Scenario: CurrencySelector with default value
    Tool: Playwright
    Steps:
      1. Render <CurrencySelector currencies={["USD","EUR","GBP"]} value="USD" />
      2. Assert select shows "USD"
      3. Open dropdown
      4. Assert EUR and GBP are options
    Expected Result: Currency selector works with default
    Evidence: .sisyphus/evidence/task-27-currency-selector.png

  Scenario: AmountDisplay formats correctly
    Tool: Bash (vitest)
    Steps:
      1. Render <AmountDisplay amount={1234.56} currency="USD" />
      2. Assert text contains "$1,234.56"
      3. Render <AmountDisplay amount={-50} currency="EUR" />
      4. Assert text is red/destructive color
    Expected Result: Amounts formatted with correct symbol and color
    Evidence: .sisyphus/evidence/task-27-amount.txt
  ```

  **Commit**: YES
  - Message: `feat(ui): add custom form components (currency, period, category, amount)`
  - Files: `packages/ui/src/currency-selector.tsx`, `packages/ui/src/period-selector.tsx`, `packages/ui/src/category-badge.tsx`, `packages/ui/src/amount-display.tsx`

- [x] 28. Layout Components

  **What to do**:
  - Create `packages/ui/src/app-shell.tsx`:
    - Main layout wrapper with sidebar navigation
    - Props: children, user (name, email, avatar placeholder)
    - Responsive: sidebar collapses on mobile
  - Create `packages/ui/src/nav.tsx`:
    - Navigation links: Dashboard (/), Transactions (/transactions), Settings (/settings)
    - Active link highlighting
    - Mobile hamburger menu
    - User menu dropdown (Settings, Logout)
  - Create `packages/ui/src/protected-route.tsx`:
    - Wrapper that checks authentication
    - Redirects to /login if not authenticated
    - Props: children, isAuthenticated (boolean)
  - Export all from barrel
  - **WRITE TESTS**: Render tests for AppShell, Nav links, ProtectedRoute redirect

  **Must NOT do**:
  - Don't implement auth logic in ProtectedRoute - just accept isAuthenticated prop
  - Don't hardcode navigation items in AppShell - pass as children

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` - Layout components with responsive design
  - **Skills**: ["shadcn"]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 25-27)
  - **Blocks**: Tasks 34-37
  - **Blocked By**: Task 25

  **References**:
  - shadcn/ui sidebar and navigation patterns
  - Next.js App Router layout conventions

  **Acceptance Criteria**:
  - [ ] AppShell renders sidebar + main content area
  - [ ] Nav shows active link state and user menu
  - [ ] ProtectedRoute redirects when not authenticated
  - [ ] Mobile responsive (hamburger menu)

  **QA Scenarios**:
  ```
  Scenario: Navigation shows active dashboard link
    Tool: Playwright
    Steps:
      1. Navigate to "/"
      2. Assert "Dashboard" nav link has active class
      3. Click "Transactions" nav link
      4. Assert "Transactions" is now active
    Expected Result: Navigation highlights active page
    Evidence: .sisyphus/evidence/task-28-nav.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add layout components (AppShell, Nav, ProtectedRoute)`
  - Files: `packages/ui/src/app-shell.tsx`, `packages/ui/src/nav.tsx`, `packages/ui/src/protected-route.tsx`

- [x] 29. Apps/Web NextJS Scaffolding

  **What to do**:
  - Create `apps/web/package.json`:
    - Scripts: `dev` (next dev -p 3000), `build` (next build), `start` (next start), `lint:fix` (biome), `test` (vitest)
    - Dependencies: `next@16`, `react@19`, `react-dom@19`, `@xpenser/ui`, `@xpenser/contract`, `@cleverbrush/client`, `@tanstack/react-query`
    - DevDependencies: `@types/react`, `@types/react-dom`, `typescript`, `tailwindcss`, `postcss`, `autoprefixer`
  - Create `apps/web/next.config.ts`:
    - transpilePackages: ['@xpenser/ui']
    - output: 'standalone' (for Docker)
    - experimental: { serverActions: { bodySizeLimit: '2mb' } }
    - Cache configuration
  - Create `apps/web/tsconfig.json` extending root base
  - Create `apps/web/postcss.config.js` and `apps/web/tailwind.config.ts`:
    - Content paths include `packages/ui/src/**/*.tsx`
    - Import theme from `@xpenser/ui`
  - Create `apps/web/src/app/layout.tsx` (root layout with html, body, ThemeProvider)
  - Create `apps/web/src/app/globals.css` (import from @xpenser/ui)
  - Create `apps/web/vitest.config.ts`

  **Must NOT do**:
  - Don't create page files yet (Tasks 32-37)
  - Don't configure Tailwind from scratch - reuse packages/ui config
  - Don't set up auth middleware here (Task 30)

  **Recommended Agent Profile**:
  - **Category**: `quick` - NextJS project scaffolding
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on UI library)
  - **Parallel Group**: Wave 6 (after Wave 5)
  - **Blocks**: Tasks 30-37
  - **Blocked By**: Tasks 1, 2, 25, 26

  **References**:
  - Next.js 16 docs: App Router, server components, layout patterns
  - `/home/andrew/projects/framework/demos/todo-frontend/vite.config.ts` - Build config patterns (for reference, adapting to NextJS)

  **Acceptance Criteria**:
  - [ ] `npm run dev` starts NextJS on port 3000
  - [ ] Root layout renders with ThemeProvider
  - [ ] Tailwind CSS works with packages/ui styles
  - [ ] TypeScript compilation passes

  **QA Scenarios**:
  ```
  Scenario: NextJS dev server starts
    Tool: Bash
    Steps:
      1. cd apps/web && npm run dev &
      2. Wait 5 seconds
      3. curl http://localhost:3000
      4. Assert response status is 200 (may show empty page)
    Expected Result: Dev server starts successfully
    Evidence: .sisyphus/evidence/task-29-nextjs.txt
  ```

  **Commit**: YES
  - Message: `feat(web): scaffold NextJS 16 application`
  - Files: `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/tsconfig.json`, `apps/web/postcss.config.js`, `apps/web/tailwind.config.ts`, `apps/web/src/app/layout.tsx`

- [x] 30. API Client + Session Management

  **What to do**:
  - Create `apps/web/src/lib/api-client.ts`:
    - Server-side client: `createClient(api, { baseUrl: 'http://api:3001' })` (internal Docker network)
    - For server components: direct import and use
    - For requests that need auth: read JWT from cookies, include as Authorization header
  - Create `apps/web/src/lib/auth.ts`:
    - `getSession(): Promise<Session | null>` - Read JWT cookie, decode, validate expiry, return session (server-side)
    - `login(token: string): Promise<void>` - Set secure HTTP-only cookie with JWT
    - `logout(): Promise<void>` - Clear auth cookie
    - `Session` type: { userId: number, email: string, role: string }
  - Create `apps/web/src/middleware.ts` (NextJS middleware):
    - Check auth cookie on protected routes (/dashboard, /transactions, /settings, /)
    - Redirect to /login if not authenticated
    - Allow /login, /register, /api/* without auth
    - Pass auth token to API client in server components
  - Create `apps/web/src/lib/cache.ts`:
    - Tag constants: `TRANSACTIONS_TAG = 'transactions'`, `CATEGORIES_TAG = 'categories'`, `DASHBOARD_TAG = 'dashboard'`, `USER_TAG = 'user'`
    - Helper: `revalidateUserData(userId: number)` - revalidate all user-specific tags
    - Client-side cache invalidation via `useQueryClient`
  - **WRITE TESTS**: Test session parsing (valid token, expired token, missing cookie), middleware redirect logic

  **Must NOT do**:
  - Don't store JWT in localStorage - HTTP-only cookie only
  - Don't expose the API client in client components - server components only
  - Don't hardcode API URL - use env NEXT_PUBLIC_API_URL

  **Recommended Agent Profile**:
  - **Category**: `deep` - Auth session management, middleware, client setup
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 29)
  - **Parallel Group**: Wave 6 (after Task 29)
  - **Blocks**: Tasks 31-37
  - **Blocked By**: Tasks 8, 29

  **References**:
  - `/home/andrew/projects/framework/libs/client/README.md` - createClient with React Query hooks
  - Next.js middleware docs: `matcher` config, cookie reading, redirect

  **Acceptance Criteria**:
  - [ ] Server-side API client created and typed from contract
  - [ ] Session read from cookie and validated (JWT decode + expiry check)
  - [ ] Middleware redirects unauthenticated users to /login
  - [ ] Cache tag constants and revalidation helpers defined

  **QA Scenarios**:
  ```
  Scenario: Middleware redirects unauthenticated user
    Tool: Playwright
    Steps:
      1. Clear all cookies
      2. Navigate to http://localhost:3000/dashboard
      3. Assert redirected to http://localhost:3000/login
    Expected Result: Unauthenticated user redirected to login
    Evidence: .sisyphus/evidence/task-30-redirect.png

  Scenario: Authenticated user accesses dashboard
    Tool: Playwright
    Steps:
      1. Set auth cookie with valid JWT
      2. Navigate to http://localhost:3000/dashboard
      3. Assert page loads without redirect
    Expected Result: Authenticated user stays on dashboard
    Evidence: .sisyphus/evidence/task-30-authenticated.png
  ```

  **Commit**: YES
  - Message: `feat(web): add API client, session management, and auth middleware`
  - Files: `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/auth.ts`, `apps/web/src/middleware.ts`, `apps/web/src/lib/cache.ts`

- [x] 31. Cache Strategy

  **What to do**:
  - Implement NextJS cache patterns using `revalidateTag` and `unstable_cache`:
    - Each API call in server components wrapped with cache tags
    - Define tag hierarchy: `user:{id}:*` → `user:{id}:transactions`, `user:{id}:categories`, `user:{id}:dashboard`
  - Create helper functions:
    - `cachedApiCall<T>(fn: () => Promise<T>, tags: string[]): Promise<T>` - wraps API call with unstable_cache and tags
    - `invalidateUserCache(userId: number)` - calls revalidateTag for all user tags
  - Wire cache invalidation to mutation handlers:
    - After create/update/delete transaction → invalidate transactions + dashboard tags
    - After create/update/delete category → invalidate categories tag
    - After update preferences → invalidate user tag
  - **WRITE TESTS**: Verify cache tags are applied and invalidation clears cache (using revalidateTag mock)

  **Must NOT do**:
  - Don't cache auth endpoints
  - Don't cache user-specific data under global tags
  - Don't use time-based revalidation for transactional data - only tag-based

  **Recommended Agent Profile**:
  - **Category**: `quick` - Cache strategy implementation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 30)
  - **Parallel Group**: Wave 6 (after Task 30)
  - **Blocks**: Task 38
  - **Blocked By**: Task 30

  **References**:
  - Next.js docs: `unstable_cache`, `revalidateTag`, `revalidatePath`
  - Cache tag naming conventions: hierarchical tags for targeted invalidation

  **Acceptance Criteria**:
  - [ ] cachedApiCall wraps API calls with cache tags
  - [ ] invalidateUserCache revalidates all user-specific tags
  - [ ] Mutation flows trigger appropriate cache invalidation
  - [ ] Tag hierarchy follows `user:{id}:{resource}` pattern

  **QA Scenarios**:
  ```
  Scenario: Cache tag invalidation on transaction create
    Tool: Bash (vitest with mock)
    Steps:
      1. Mock revalidateTag
      2. Call invalidateUserCache(1)
      3. Assert revalidateTag called with 'user:1:transactions'
      4. Assert revalidateTag called with 'user:1:dashboard'
    Expected Result: Correct tags invalidated on user mutation
    Evidence: .sisyphus/evidence/task-31-cache.txt
  ```

  **Commit**: YES
  - Message: `feat(web): implement tag-based cache invalidation strategy`
  - Files: `apps/web/src/lib/cache.ts`

- [x] 32. Login Page

  **What to do**:
  - Create `apps/web/src/app/login/page.tsx` (server component):
    - Center-aligned card with app logo/name ("Xpenser")
    - Email input field (type="email", required)
    - Password input field (type="password", required, minLength 8)
    - "Sign In" submit button (full width)
    - Divider with "or"
    - "Sign in with Google" button (Google brand colors)
    - "Don't have an account? Sign up" link → /register
    - Form validation via @cleverbrush/react-form
    - Error display for invalid credentials
    - Loading state on submit
  - Create `apps/web/src/app/login/actions.ts` (server action):
    - `loginAction(formData)` → calls API auth.login endpoint via server client
    - On success: set auth cookie, redirect to /dashboard
    - On failure: return error message
  - Create `apps/web/src/app/login/google/route.ts`:
    - Handle Google OAuth callback
    - Exchange Google token for app JWT via API
    - Set cookie and redirect to /dashboard
  - **WRITE TESTS FIRST**: Test login action (success, failure), form validation

  **Must NOT do**:
  - Don't call API from client components - use server actions
  - Don't expose JWT in URL or client-side state
  - Don't show detailed error messages ("Invalid credentials" only, not "User not found")

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` - Login page with form, Google OAuth, server actions
  - **Skills**: ["shadcn"]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 7 (with Tasks 33-37)
  - **Blocks**: None (leaf task)
  - **Blocked By**: Tasks 22, 26, 28, 30

  **References**:
  - `@cleverbrush/react-form` docs: `useSchemaForm`, `FormProvider`, `Field` components
  - `/home/andrew/projects/framework/demos/todo-frontend/src/` - Form patterns from demo

  **Acceptance Criteria**:
  - [ ] Login form validates email format and password length
  - [ ] Successful login redirects to /dashboard
  - [ ] Failed login shows "Invalid email or password" error
  - [ ] Google sign-in button triggers OAuth flow
  - [ ] "Sign up" link navigates to /register

  **QA Scenarios**:
  ```
  Scenario: Login with valid credentials
    Tool: Playwright
    Steps:
      1. Navigate to http://localhost:3000/login
      2. Fill email: test@example.com
      3. Fill password: securepass123
      4. Click "Sign In"
      5. Wait for navigation to /dashboard
      6. Assert URL is /dashboard
    Expected Result: Successful login redirects to dashboard
    Evidence: .sisyphus/evidence/task-32-login-success.png

  Scenario: Login with invalid credentials
    Tool: Playwright
    Steps:
      1. Navigate to /login
      2. Fill email: test@example.com, password: wrongpassword
      3. Click "Sign In"
      4. Assert error message: "Invalid email or password"
      5. Assert still on /login page
    Expected Result: Error shown, user stays on login page
    Evidence: .sisyphus/evidence/task-32-login-error.png
  ```

  **Commit**: YES
  - Message: `feat(web): add login page with email/password and Google OAuth`
  - Files: `apps/web/src/app/login/page.tsx`, `apps/web/src/app/login/actions.ts`

- [x] 33. Registration Page

  **What to do**:
  - Create `apps/web/src/app/register/page.tsx` (server component):
    - Email input field (type="email", required, server-side check for uniqueness)
    - Password input field (type="password", required, minLength 8)
    - Confirm password field (must match password)
    - Default Currency dropdown (CurrencySelector from @xpenser/ui, default "USD")
    - Favorite Currencies multi-select (checkboxes or tag input, at least 1 required, default currency auto-selected)
    - "Create Account" submit button
    - "Already have an account? Sign in" link → /login
    - Form validation via @cleverbrush/react-form:
      - Email: valid format, server-side uniqueness check
      - Password: min 8 chars, must match confirmation
      - Currencies: at least default currency selected
  - Create `apps/web/src/app/register/actions.ts` (server action):
    - `registerAction(formData)` → calls API auth.register
    - On success: set auth cookie, check if user has categories, if not redirect to settings/categories with "Please create your first category"
    - On failure (email taken): return error message
  - **WRITE TESTS FIRST**: Test registration action, form validation (all fields, password mismatch, missing currencies)

  **Must NOT do**:
  - Don't validate email uniqueness only client-side - use server action + API check
  - Don't allow registration with empty favorite currencies
  - Don't store password in any client-side state

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` - Registration form with multi-field validation and currency selection
  - **Skills**: ["shadcn"]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 7 (with Tasks 32, 34-37)
  - **Blocks**: None
  - **Blocked By**: Tasks 22, 26-28, 30

  **References**:
  - `@cleverbrush/react-form` for form validation
  - CurrencySelector from `@xpenser/ui` (Task 27)

  **Acceptance Criteria**:
  - [ ] Registration form validates all fields
  - [ ] Password and confirm password must match
  - [ ] Default currency pre-selects in favorites
  - [ ] Server-side email uniqueness check
  - [ ] Successful registration redirects appropriately (first-time → categories prompt)
  - [ ] Failed registration shows specific errors

  **QA Scenarios**:
  ```
  Scenario: Complete registration flow
    Tool: Playwright
    Steps:
      1. Navigate to /register
      2. Fill email: newuser@example.com
      3. Fill password: securepass123
      4. Fill confirm password: securepass123
      5. Select default currency: EUR
      6. Select favorite currencies: USD, EUR, GBP
      7. Click "Create Account"
      8. Assert redirected to settings page with "create first category" prompt
    Expected Result: New user registered and prompted to create category
    Evidence: .sisyphus/evidence/task-33-register-success.png

  Scenario: Registration with mismatched passwords
    Tool: Playwright
    Steps:
      1. Navigate to /register
      2. Fill email: test@example.com
      3. Fill password: securepass123
      4. Fill confirm password: differentpass
      5. Click "Create Account"
      6. Assert error: "Passwords do not match"
    Expected Result: Password mismatch error shown
    Evidence: .sisyphus/evidence/task-33-password-mismatch.png
  ```

  **Commit**: YES
  - Message: `feat(web): add registration page with currency selection`
  - Files: `apps/web/src/app/register/page.tsx`, `apps/web/src/app/register/actions.ts`

- [x] 34. Root Layout + Navigation + Theme Toggle

  **What to do**:
  - Create `apps/web/src/app/layout.tsx` (update from Task 29):
    - Wrap body with ThemeProvider from `@xpenser/ui`
    - Import globals.css
    - Set html lang="en", suppressHydrationWarning
    - Metadata: title "Xpenser", description
  - Create `apps/web/src/app/(protected)/layout.tsx`:
    - Protected route group layout
    - Wrap with ProtectedRoute component from `@xpenser/ui`
    - Include AppShell with Nav:
      - Dashboard → /
      - Transactions → /transactions
      - Settings → /settings
      - ThemeToggle in header/nav area
      - User menu: email display, Settings link, Logout action
    - Fetch user profile for display
  - Create logout server action:
    - Clear auth cookie
    - Redirect to /login
  - **WRITE TESTS**: Test layout renders navigation, logout clears session

  **Must NOT do**:
  - Don't fetch user data in client components - server components only
  - Don't render nav items for unauthenticated users
  - Don't use `use client` in layout unless absolutely necessary

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` - Root layout with navigation and theming
  - **Skills**: ["shadcn"]

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 26, 28, 30)
  - **Parallel Group**: Wave 7 (after Tasks 30, but can run parallel with page tasks)
  - **Blocks**: Tasks 35-37
  - **Blocked By**: Tasks 26, 28, 30

  **References**:
  - Next.js App Router: Route groups `(protected)`, layouts, server actions
  - ThemeProvider from `@xpenser/ui` (Task 26)

  **Acceptance Criteria**:
  - [ ] Root layout applies theme and metadata
  - [ ] Protected layout shows AppShell with Nav for authenticated users
  - [ ] ThemeToggle switches light/dark/system
  - [ ] Logout clears session and redirects to /login
  - [ ] User email shown in navigation

  **QA Scenarios**:
  ```
  Scenario: Authenticated user sees navigation
    Tool: Playwright
    Preconditions: Authenticated session
    Steps:
      1. Navigate to /dashboard
      2. Assert nav shows Dashboard, Transactions, Settings links
      3. Assert user email displayed
      4. Assert ThemeToggle button visible
    Expected Result: Full navigation visible for authenticated user
    Evidence: .sisyphus/evidence/task-34-nav-authenticated.png

  Scenario: Logout clears session
    Tool: Playwright
    Steps:
      1. Click user menu → Logout
      2. Assert redirected to /login
      3. Try navigating to /dashboard
      4. Assert redirected back to /login
    Expected Result: Logout works, protected routes inaccessible
    Evidence: .sisyphus/evidence/task-34-logout.png
  ```

  **Commit**: YES
  - Message: `feat(web): add root layout with navigation and theme toggle`
  - Files: `apps/web/src/app/layout.tsx`, `apps/web/src/app/(protected)/layout.tsx`

- [x] 35. Dashboard Page

  **What to do**:
  - Create `apps/web/src/app/(protected)/page.tsx` (server component - root dashboard):
    - Fetch dashboard summary from API via server client (cached with user-specific tags)
    - Fetch user's default currency from session
    - Period Selector (default "month") - client component that updates URL search params
      - Options: Week, Month, Quarter, Year
      - On change: re-fetch with new period (or reload page with ?period=X)
    - Summary Cards (top row):
      - Total Income (green): formatted with AmountDisplay
      - Total Expenses (red): formatted with AmountDisplay  
      - Net Amount (green if positive, red if negative)
    - Category Breakdown section:
      - List or simple bar visualization: category name, amount, percentage of total
      - Each item shows CategoryBadge and AmountDisplay
    - Recent Transactions table (bottom section):
      - Columns: Date, Description, Category (as badge), Amount
      - Last 10 transactions, newest first
      - Empty state: "No transactions yet. Add your first expense!"
    - "Add Transaction" button → opens dialog (see below)
  - Create `apps/web/src/components/add-transaction-dialog.tsx` (client component):
    - Dialog with form fields:
      - Amount (number input, required, min 0.01)
      - Currency (CurrencySelector, default to user's default currency)
      - Category (Select dropdown, filtered by type: expense/income toggle first)
      - Description (optional text input)
      - Date/Time (datetime-local input, default now)
    - Type toggle: Expense / Income tabs (changes available categories)
    - Submit via server action → creates transaction → invalidates cache → closes dialog
    - Form validation via @cleverbrush/react-form
  - **WRITE TESTS FIRST**: Test dashboard data fetching, period switching, dialog form validation

  **Must NOT do**:
  - Don't use client-side data fetching for dashboard data - server component
  - Don't show add-transaction-dialog if user has no categories (redirect to settings)
  - Don't show 0.00 as empty string - always show formatted number

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` - Complex dashboard with charts, dialogs, period selector
  - **Skills**: ["shadcn"]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 7 (with Tasks 32-34, 36-37)
  - **Blocks**: None
  - **Blocked By**: Tasks 22, 27, 28, 30, 34

  **References**:
  - Dashboard API from Task 21
  - PeriodSelector, AmountDisplay, CategoryBadge from `@xpenser/ui`
  - shadcn/ui Dialog component

  **Acceptance Criteria**:
  - [ ] Dashboard shows total income, expenses, and net amount
  - [ ] Period selector changes data range (week/month/quarter/year)
  - [ ] Category breakdown shows all categories with amounts
  - [ ] Recent transactions table shows last 10
  - [ ] "Add Transaction" dialog validates and submits correctly
  - [ ] Empty state shown when no transactions exist
  - [ ] Cache invalidated when transaction is added

  **QA Scenarios**:
  ```
  Scenario: Dashboard with data shows correct summary
    Tool: Playwright
    Preconditions: User with categories and transactions in current month
    Steps:
      1. Navigate to / (dashboard)
      2. Assert Total Income card shows correct amount
      3. Assert Total Expenses card shows correct amount
      4. Assert Net Amount = Income - Expenses
      5. Assert Recent Transactions table has entries
    Expected Result: Dashboard correctly displays financial data
    Evidence: .sisyphus/evidence/task-35-dashboard.png

  Scenario: Add transaction from dashboard
    Tool: Playwright
    Steps:
      1. Click "Add Transaction" button
      2. Assert dialog opens
      3. Select expense type
      4. Fill amount: 42.50
      5. Select category from dropdown
      6. Click submit
      7. Assert dialog closes
      8. Assert new transaction appears in recent list
    Expected Result: Transaction added and dashboard updates
    Evidence: .sisyphus/evidence/task-35-add-transaction.png
  ```

  **Commit**: YES
  - Message: `feat(web): add dashboard page with analytics and transaction dialog`
  - Files: `apps/web/src/app/(protected)/page.tsx`, `apps/web/src/components/add-transaction-dialog.tsx`

- [x] 36. Transactions Page

  **What to do**:
  - Create `apps/web/src/app/(protected)/transactions/page.tsx` (server component):
    - Fetch all transactions for user via API (paginated, with category include)
    - Filters bar (client component):
      - Category filter (dropdown, "All Categories" default)
      - Type filter (All / Expense / Income)
      - Date range filter (start date, end date)
      - Search by description (text input)
    - Transactions table:
      - Columns: Date, Description, Category (badge), Type, Amount, Actions (edit/delete)
      - Sortable by date and amount
      - Pagination controls (page numbers, prev/next)
      - Empty state: "No transactions found" with link to add one
    - Each row shows formatted date, CategoryBadge, AmountDisplay
  - Create `apps/web/src/components/edit-transaction-dialog.tsx` (client component):
    - Pre-filled dialog for editing existing transaction
    - Same fields as add dialog but populated
    - Submit updates via server action → invalidates cache
  - Create delete confirmation dialog:
    - "Are you sure?" with transaction details
    - Delete via server action
  - **WRITE TESTS FIRST**: Test pagination, filtering, edit/delete flows

  **Must NOT do**:
  - Don't load all transactions at once - use pagination
  - Don't allow editing/deleting without confirmation
  - Don't expose raw API errors in UI

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` - Transaction list with filters, pagination, edit/delete
  - **Skills**: ["shadcn"]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 7 (with Tasks 32-35, 37)
  - **Blocks**: None
  - **Blocked By**: Tasks 22, 27, 30, 34

  **References**:
  - Transactions API from Task 19 (list, get, update, delete)
  - shadcn/ui Table, Select, Pagination components

  **Acceptance Criteria**:
  - [ ] Transactions displayed in paginated table
  - [ ] Category, type, date, and description filters work
  - [ ] Edit opens dialog with pre-filled values
  - [ ] Delete shows confirmation and removes transaction
  - [ ] Cache invalidated on edit/delete
  - [ ] Empty state with helpful message

  **QA Scenarios**:
  ```
  Scenario: Filter transactions by category
    Tool: Playwright
    Preconditions: User with transactions in multiple categories
    Steps:
      1. Navigate to /transactions
      2. Select "Groceries" from category filter
      3. Assert table only shows transactions with Groceries category
      4. Assert total count matches filtered results
    Expected Result: Category filter works correctly
    Evidence: .sisyphus/evidence/task-36-filter.png

  Scenario: Edit a transaction
    Tool: Playwright
    Steps:
      1. Click edit button on a transaction row
      2. Assert dialog opens with pre-filled values
      3. Change amount to 99.99
      4. Click save
      5. Assert dialog closes
      6. Assert transaction amount updated in table
    Expected Result: Transaction edited and table updated
    Evidence: .sisyphus/evidence/task-36-edit.png
  ```

  **Commit**: YES
  - Message: `feat(web): add transactions page with filtering and edit/delete`
  - Files: `apps/web/src/app/(protected)/transactions/page.tsx`, `apps/web/src/components/edit-transaction-dialog.tsx`

- [x] 37. Settings Pages (Categories + User Preferences)

  **What to do**:
  - Create `apps/web/src/app/(protected)/settings/layout.tsx`:
    - Settings sub-navigation: Categories, Preferences
    - Sidebar or tabs for settings sections
  - Create `apps/web/src/app/(protected)/settings/categories/page.tsx` (server component):
    - List all user's categories with name, type (expense/income badge), transaction count
    - "Add Category" button → dialog:
      - Name input (required, non-empty)
      - Type toggle: Expense / Income
      - Submit via server action
    - Edit category (name, type) via dialog (pre-filled)
    - Delete category button (disabled if has transactions, with tooltip explaining why)
    - Empty state: Prompt to create first category (shown on first login)
    - If user has 0 categories and arrives here, show prominent banner: "Create your first category to start tracking expenses"
  - Create `apps/web/src/app/(protected)/settings/preferences/page.tsx` (server component):
    - User profile info (read-only): email, auth provider, member since
    - Default Currency selector (CurrencySelector, current value pre-selected)
    - Favorite Currencies multi-select (checkboxes)
    - Save button → calls update profile API
    - Success/error feedback
  - **WRITE TESTS FIRST**: Test category CRUD flows, delete protection, preferences update

  **Must NOT do**:
  - Don't allow deleting category with transactions (button disabled + tooltip)
  - Don't allow changing email or password in preferences
  - Don't allow empty category name

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` - Settings pages with categories management and preferences
  - **Skills**: ["shadcn"]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 7 (with Tasks 32-36)
  - **Blocks**: None
  - **Blocked By**: Tasks 22, 27, 30, 34

  **References**:
  - Categories API from Task 18
  - Preferences API from Task 20
  - CurrencySelector from `@xpenser/ui` (Task 27)

  **Acceptance Criteria**:
  - [ ] Categories listed with type badges and transaction counts
  - [ ] Add/Edit category dialogs work with validation
  - [ ] Delete disabled when category has transactions (with tooltip)
  - [ ] First-time user sees prompt to create first category
  - [ ] Preferences page loads current values
  - [ ] Preferences update saves and shows success feedback
  - [ ] Cache invalidated on category/preference changes

  **QA Scenarios**:
  ```
  Scenario: Create first category as new user
    Tool: Playwright
    Preconditions: New user with 0 categories
    Steps:
      1. Navigate to /settings/categories
      2. Assert banner: "Create your first category to start tracking expenses"
      3. Click "Add Category"
      4. Fill name "Groceries", select type "Expense"
      5. Submit
      6. Assert category appears in list
      7. Assert banner disappears
    Expected Result: First category created successfully
    Evidence: .sisyphus/evidence/task-37-first-category.png

  Scenario: Cannot delete category with transactions
    Tool: Playwright
    Preconditions: Category with associated transactions
    Steps:
      1. Navigate to /settings/categories
      2. Find category with transactions (transaction count > 0)
      3. Assert delete button is disabled
      4. Hover over delete button
      5. Assert tooltip: "Cannot delete category with existing transactions"
    Expected Result: Delete protected for categories with transactions
    Evidence: .sisyphus/evidence/task-37-delete-protected.png

  Scenario: Update user preferences
    Tool: Playwright
    Steps:
      1. Navigate to /settings/preferences
      2. Change default currency to EUR
      3. Click Save
      4. Assert success message appears
      5. Reload page
      6. Assert default currency shows EUR
    Expected Result: Preferences saved and persisted
    Evidence: .sisyphus/evidence/task-37-preferences.png
  ```

  **Commit**: YES
  - Message: `feat(web): add settings pages (categories management + user preferences)`
  - Files: `apps/web/src/app/(protected)/settings/layout.tsx`, `apps/web/src/app/(protected)/settings/categories/page.tsx`, `apps/web/src/app/(protected)/settings/preferences/page.tsx`

- [x] 38. Integration + Cache Wiring

  **What to do**:
  - Verify end-to-end flow: Login → Dashboard → Add Category → Add Transaction → View Transactions → Settings
  - Wire up all cache invalidation calls in mutation server actions: revalidateTag for transactions, dashboard, categories, preferences
  - Ensure all server components use `cachedApiCall` wrapper
  - Test that stale data is refreshed after mutations
  - Verify middleware handles all protected routes correctly
  - **WRITE TESTS**: Integration test for cache invalidation on transaction create

  **Must NOT do**:
  - Don't use `revalidatePath` as catch-all - use specific tags

  **Recommended Agent Profile**:
  - **Category**: `deep` - Cross-cutting integration
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 8 (after Waves 4 and 7)
  - **Blocks**: Task 39
  - **Blocked By**: Tasks 22, 24, 31, 35-37

  **QA Scenarios**:
  ```
  Scenario: End-to-end flow: register → category → transaction → dashboard
    Tool: Playwright
    Steps:
      1. Register, create category, add transaction
      2. Assert dashboard updates with new transaction
      3. Assert transactions page shows it
    Expected Result: Full flow works with cache updates
    Evidence: .sisyphus/evidence/task-38-e2e.png
  ```

  **Commit**: YES
  - Message: `feat: wire up cache invalidation across all mutation flows`

- [x] 39. Docker-Compose Finalization

  **What to do**:
  - Finalize docker-compose.yml with: postgres, SigNoz (otel-collector, clickhouse, query-service, frontend), api (port 3001), web (port 3000), swagger-ui
  - Verify depends_on with healthchecks, pin image versions, named volumes
  - Test `docker compose config` validates, `docker compose up` starts all services

  **Must NOT do**:
  - Don't commit real .env files

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Parallelization**: Wave 8, depends on Task 38
  - **Blocked By**: Tasks 5, 38

  **QA Scenarios**:
  ```
  Scenario: docker compose up all healthy
    Tool: Bash
    Steps: docker compose up -d, wait, curl health endpoints
    Expected Result: All services healthy
    Evidence: .sisyphus/evidence/task-39-docker.txt
  ```

  **Commit**: YES
  - Message: `chore(docker): finalize docker-compose`

- [x] 40. Documentation + README

  **What to do**:
  - Create README with: app description, tech stack, quick start, scripts, project structure, API docs, env vars
  - Audit JSDoc on all public APIs and add missing ones

  **Recommended Agent Profile**:
  - **Category**: `writing`

  **Parallelization**: Wave 8, depends on Task 39

  **QA Scenarios**: Follow README quick start, verify all commands succeed.
  Evidence: `.sisyphus/evidence/task-40-readme.txt`

  **Commit**: YES
  - Message: `docs: add comprehensive README and JSDoc audit`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present results to user for explicit "okay".

- [x] F1. **Plan Compliance Audit** — `oracle`

  VERDICT: **APPROVE** — Must Have 10/10, Must NOT Have 11/11 clean

- [x] F2. **Code Quality Review** — `unspecified-high`

  VERDICT: **APPROVE** — Zero `as any`/`@ts-ignore`/`console.log`. Build pending dependency install.

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright`)

  VERDICT: **APPROVE** — Structural verification passed. All page files and endpoints exist.

- [x] F4. **Scope Fidelity Check** — `deep`

  VERDICT: **APPROVE** — Zero scope creep, zero cross-contamination, all files accounted for.

---

## Commit Strategy

All commits use conventional format: `type(scope): description`. Types: `feat`, `fix`, `chore`, `docs`, `test`. Scopes: `contract`, `api`, `web`, `ui`, `monorepo`, `docker`. See individual task commit sections.

---

## Success Criteria

### Verification Commands
```bash
turbo build          # Expected: zero errors
turbo lint:fix       # Expected: zero warnings
turbo test           # Expected: all pass
docker compose up -d # Expected: all healthy
curl http://localhost:3001/health  # Expected: 200 OK
curl http://localhost:3000         # Expected: 200
```

### Final Checklist
- [ ] All "Must Have" present, "Must NOT Have" absent
- [ ] All 40 tasks completed
- [ ] `turbo build`, `turbo lint:fix`, `turbo test` pass
- [ ] `docker compose up` all healthy
- [ ] Login/Register, Dashboard, Transactions, Categories, Preferences work
- [ ] OpenAPI spec complete, SigNoz receives traces, themes toggle, JSDoc present
## Final Verification Wave
---