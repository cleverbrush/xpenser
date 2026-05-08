# Xpenser - Architectural Decisions

## ADR-001: Monorepo with Turborepo
- 4 packages: contract (shared), ui (shadcn), api (@cleverbrush/server), web (NextJS 16)
- Shared contract enables type-safe client generation

## ADR-002: Two-Service Architecture
- NextJS on :3000, @cleverbrush/server on :3001
- NextJS server components call API via @cleverbrush/client (server-side HTTP)
- API independently accessible for 3rd parties

## ADR-003: @cleverbrush/auth for JWT (not NextAuth.js)
- jwtScheme + google-auth-library for Google OAuth
- JWT stored in HTTP-only secure cookie

## ADR-004: Frankfurter via @cleverbrush/scheduler
- Daily cron job fetches rates → PostgreSQL → API reads from DB

## ADR-005: Dual-Layer Caching
- NextJS: revalidateTag() for page/component cache
- API: ETag/in-memory cache with tag-based invalidation

## ADR-006: TDD with Vitest
- RED-GREEN-REFACTOR on every implementation task
- Agent-Executed QA scenarios for verification
