# Cleverbrush Reference Notes

xpenser is both a usable personal finance app and a reference implementation for
projects based on CleverBrush Framework. This document points to the patterns
worth copying and the checks that keep those patterns from drifting.

Framework source: [cleverbrush/framework](https://github.com/cleverbrush/framework).

## Learning Path

1. Start with `packages/contracts/src/api.ts` and
   `packages/contracts/src/schemas.ts` to see the public API shape.
2. Compare that contract with `apps/api/src/api/endpoints.ts` and
   `apps/api/src/api/handlers` to see how metadata and handlers line up.
3. Read `packages/client/src/index.ts` for the client middleware stack.
4. Read `packages/ui/src/forms/react-form-provider.tsx` for schema-backed form
   bindings.
5. Use the tests listed below as executable examples of the framework
   invariants.

## Architecture Map

- `packages/contracts` defines the public API with `@cleverbrush/schema` and
  `@cleverbrush/server/contract`. These schemas are the source of truth for
  TypeScript types, request validation, OpenAPI output, form bindings, and typed
  clients.
- `apps/api/src/api/endpoints.ts` enriches the shared contract with
  server-only metadata: DI tokens, summaries, descriptions, tags, and operation
  IDs. `apps/api/src/api/handlers` contains the matching handler tree.
- `apps/api/src/server.ts` builds the Cleverbrush server with tracing first,
  CORS, structured request logging, DI, authentication, authorization,
  healthchecks, batching, OpenAPI, MCP, and all contract handlers.
- `packages/client` wraps `@cleverbrush/client` with the app middleware stack:
  OTel context propagation, retry, timeout, dedupe, in-memory tag caching,
  optional external tag invalidation, and root-path batching.
- `packages/ui/src/forms/react-form-provider.tsx` registers xpenser UI renderers
  for `@cleverbrush/react-form`, so app forms bind fields with property
  selectors instead of string paths.
- `apps/api/src/db/schemas.ts` defines typed ORM entities with
  `@cleverbrush/orm`; `apps/api/src/di/setup.ts` exposes the instrumented Knex
  pool and ORM context through Cleverbrush DI.
- `npm run db:validate -w @xpenser/api` runs the read-only Cleverbrush ORM
  schema drift check against a live database.

## Framework Usage Rules

- Reuse exported schema constants when a type appears in more than one endpoint.
  Use `.schemaName()` for object-level components that should become OpenAPI
  `$ref`s.
- Do not clone a named schema with `.describe()`, `.optional()`, `.nullable()`,
  or `.default()` and then reuse it elsewhere. The OpenAPI registry requires a
  single object reference per schema name. Leaf fragments are intentionally left
  unnamed when they need per-property descriptions.
- Keep the public contract tree, API endpoint metadata tree, and handler tree in
  the same shape. The endpoint-map tests enforce this.
- Put `tracingMiddleware()` before other API middleware so logs and database
  spans correlate with the request span.
- Use `ActionResult` helpers in handlers for expected API statuses; reserve
  thrown errors for unexpected failures or framework `HttpError` cases.
- Use `ActionResult.raw()` for integrations that must own the native Node
  request/response lifecycle, such as MCP transports.
- Keep credential-bearing integrations behind server-side modules. Browser code
  should call Server Actions or route handlers rather than the API directly.

## Security Baseline

- Local `.env.example` values are safe for development only. API, web, and
  Telegram bot startup all refuse documented placeholder secrets in production.
- Passwords use scrypt with per-password salts. API keys, Telegram link tokens,
  and email confirmation tokens are stored as hashes.
- The API uses Cleverbrush's ordered `trySchemes: ['api-key', 'jwt']` with
  application-owned credential guards. A nonempty `X-API-Key` takes precedence
  over bearer credentials; an invalid selected API key never falls through to a
  JWT. API keys are also accepted as bearer tokens. Single-user restrictions and
  principal claims apply to both schemes.
- Native `trySchemes` support was already available in Framework 4.4.0. The
  dependency upgrade to 4.4.3 independently brings published routing and
  prototype-pollution fixes.
- MCP keeps its separate API-key/OAuth authentication. MCP OAuth tokens are not
  accepted by ordinary REST endpoints, and regular app JWTs do not grant MCP
  access.
- Knex spans are emitted for database visibility, but SQL text is redacted at
  the instrumentation boundary.
- Telegram tracing records low-cardinality command/action names instead of raw
  callback payloads or deep-link tokens.

## Tests To Keep

- Contract authorization tests in `packages/contracts/src/api.test.ts`.
- Endpoint drift and OpenAPI generation tests in
  `apps/api/src/api/endpoints.test.ts`.
- Config guard tests for API, web, and Telegram bot production secrets.
- Client middleware tests for batching, retry, timeout, dedupe, cache tags, and
  tracing order.
- Form provider tests that prove Cleverbrush schema fields resolve to the
  expected xpenser UI controls.
- E2E workflow tests for authenticated app behavior and preview validation.

## Adding New Features

1. Add or update the schema in `packages/contracts/src/schemas.ts`.
2. Add the endpoint to `packages/contracts/src/api.ts` with auth and cache tags.
3. Enrich the endpoint in `apps/api/src/api/endpoints.ts` with DI and OpenAPI
   metadata.
4. Add the matching handler in `apps/api/src/api/handlers`.
5. Use `createXpenserClient()` from server-side web code or external clients.
6. Add focused tests for schema validation, handler behavior, contract metadata,
   and any changed UI flow.
