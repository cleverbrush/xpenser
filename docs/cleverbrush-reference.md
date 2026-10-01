# Cleverbrush Reference Notes

xpenser is both a usable personal finance app and a reference implementation for
projects based on CleverBrush Framework. This document points to the patterns
worth copying and the checks that keep those patterns from drifting.

Framework source: [cleverbrush/framework](https://github.com/cleverbrush/framework).

All directly used Framework packages are pinned to
`0.0.0-beta-20261001112349` (the v5 immutable-query beta).

## Learning Path

1. Start with `packages/contracts/src/api.ts` and
   `packages/contracts/src/schemas.ts` to see the public API shape.
2. Compare that contract with `apps/api/src/api/features` to see server-only
   scopes, separately typed handlers, and operation-specific error policies.
   `apps/api/src/api/implementation.ts` composes all feature modules.
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
- `apps/api/src/api/features/<feature>/scope.ts` enriches a contract group with
  server-only DI tokens and OpenAPI metadata. `handlers/<operation>.ts` imports
  that scope as a type only. `index.ts` binds the handlers and compatible error
  policies. `implementation.ts` composes the modules; `.complete()` checks that
  every contract operation is implemented exactly once.
- `apps/api/src/server.ts` builds the Cleverbrush server with tracing first,
  CORS, structured request logging, DI, authentication, authorization,
  healthchecks, batching, OpenAPI, MCP, and all contract handlers.
- `packages/client` wraps `@cleverbrush/client` with the app middleware stack:
  OTel context propagation, retry, timeout, dedupe, in-memory tag caching,
  optional external tag invalidation, and root-path batching.
- `packages/ui/src/forms/react-form-provider.tsx` exports `XpenserFormSystem`,
  a typed renderer registry for `@cleverbrush/react-form`.
  `apps/web/components/forms/schema-fields.tsx` composes it with the web-only
  currency multiselect. App forms bind fields with property selectors instead
  of string paths, and renderer-specific props are checked at each call site.
- `apps/api/src/db/schemas.ts` defines typed ORM entities with
  `@cleverbrush/orm`; `apps/api/src/di/setup.ts` exposes the instrumented Knex
  pool and ORM context through Cleverbrush DI.
- `npm run db:validate -w @xpenser/api` runs the read-only Cleverbrush ORM
  schema drift check against a live database.

## Framework Usage Rules

- Reuse exported schema constants when a type appears in more than one endpoint.
  Use `.schemaName()` for object-level components that should become OpenAPI
  `$ref`s.
- Ordinary use-site modifiers such as `.describe()`, `.optional()`, and
  `.nullable()` preserve a named schema's canonical reference. Use them directly
  instead of wrapping an object in a union solely to keep its OpenAPI name.
  Each use retains its own description, requiredness, and nullability.
- Structural changes, validation rules, preprocessors, defaults, fallbacks, and
  extensions detach the inherited component name. Name distinct derivatives
  explicitly after their changes, as with `UpdateTransactionBodySchema`.
  Independently defined schemas must still have distinct component names.
- At external-data boundaries, use optional-aware `.catch(undefined)` for
  malformed optional scalars. Optional schemas accept null at runtime, so add
  a preprocessor when the application needs null normalized to undefined.
  `apps/api/src/application/brandfetch-schemas.ts` demonstrates this alongside
  explicit field selection and filtering of malformed array entries; fallback
  schemas do not replace the provider-specific boundary policy.
- Use `implement(api).group(...)` to configure each feature, and `.withHandlers()`
  to bind it. Do not maintain parallel endpoint and handler trees. Keep shared DI
  defaults limited to dependencies used by every operation; use `operations`
  overrides otherwise. Authorization and cache behavior belong in the contract.
- Keep scopes independent of handlers, and use type-only scope imports inside
  handlers to avoid runtime import cycles. Root composition stays a short list
  of modules, not a chain containing business logic.
- Put `tracingMiddleware()` before other API middleware so logs and database
  spans correlate with the request span.
- Translate expected application exceptions with feature-local `errorMap()`
  policies attached in the registration descriptor. Every translated status and
  body must already exist in the contract. Share narrow policies (for example
  budget access), not a catch-all policy. Unknown errors propagate unchanged.
- Keep direct conditional `ActionResult` responses and success/file/raw results
  in handlers. Logging and authorization checks remain where their context is
  available; do not move them into generic exception policies.
- Use `ActionResult.raw()` for integrations that must own the native Node
  request/response lifecycle, such as MCP transports.
- Keep credential-bearing integrations behind server-side modules. Browser code
  should call Server Actions or route handlers rather than the API directly.

## Form Ownership

Xpenser uses Framework for end-to-end field
validation. Feature actions live in `apps/web/lib/actions/<feature>.ts`;
`actions.ts` is only a compatibility facade. Read `form-errors.ts` for
the server boundary and `form-result.ts` for the serializable result types.

- Decode API 400/422 problem details with `decodeValidationIssues(error,
  { source: 'body' })` **before** Next.js serializes the action result.
  Return `{ ok: false, error, issues }` directly to `handleSubmit`. Do not
  reconstruct field names from messages or catch failures as success.
- API body pointers become form-relative JSON Pointers. Keep root, unbound,
  and non-body failures in the summary. Map only explicit UI differences:
  tag/currency array elements to the compound control, upload properties to
  the file control, and category setup errors to their row index.
- Preserve expected domain messages, but rethrow unexpected failures and
  navigation exceptions. Neither cache invalidation nor success effects run
  after a rejected write.
- The controller clears server issues when their fields change and discards
  stale submissions after reset. A server rejection must preserve entered
  values and leave the form open.
- Multi-write flows track acknowledged writes: category setup retries only
  unsaved rows; scan review retries its confirmation without recreating the
  acknowledged transaction. This is not backend idempotency: an ambiguous
  network failure before acknowledgement still needs separate safeguards.

For example, the feature action owns its successful cache invalidation:

```ts
// lib/actions/categories.ts
export async function createCategoryAction(data: FormData) {
    return runFormAction(async () => {
        const client = await getApiClient();
        const category = await client.categories.create({ body: categoryBody(data) });
        revalidatePath('/settings/categories');
        return category;
    }, 'Could not save category.');
}

// components/forms/category-form.tsx
const submit = form.handleSubmit(
    values => createCategoryAction(valuesToFormData(values)),
    { onSuccess: category => onSaved(category), onError: submissionError('Could not save category.') }
);
```

The same contract schema binds the browser fields; no per-form API-error
parser is necessary. See the real actions and components for budget selection,
permissions, and additional invalidation paths.

- Use `useSchemaForm(schema)` with the shared `SchemaField` for rendered inputs,
  and `form.useField(field => field.property)` for headless bindings. A field's
  schema determines its accepted value and available renderer variants.
- Let `form.handleSubmit()` own validation, duplicate-submit suppression,
  `submitting`, and `error`. Return `{ ok: false, error }` for expected action
  failures and put success effects in `onSuccess`. Preserve Next.js redirect
  exceptions in `onError`; they are navigation, not form failures.
- Use `form.reset(values)` when opening a dialog or replacing its initial data.
  This synchronizes mounted controls and invalidates obsolete submission
  callbacks without remount keys. Schema defaults apply during validation;
  explicitly supply values that should be visible before submission.
- Keep application-only state outside the controller: editable amount/date
  buffers, transaction filters, suggestion queries, confirmation screens, and
  undo state. Do not mirror canonical schema values in React state.
- When different field kinds share a renderer variant (for example string and
  number selects), explicitly type custom callback parameters and update the
  corresponding headless binding. This avoids ambiguous callback inference
  while preserving schema-checked values.

## Immutable Reads and Synchronous Mapping

- Configuration calls on Framework queries return new builders. Chain them,
  assign conditional branches, and return predicate/include callback results.
  Native Knex callbacks still follow Knex's mutable semantics.
- `application/entity-reads.ts` and `transaction-queries.ts` own reusable
  projections. `read-models.ts` caches definitions in a `WeakMap` keyed by the
  Knex connection; transaction connections get separate entries. It never
  caches rows or request-specific authorization predicates.
- Branch the same filtered transaction query into count and page queries.
  Numbered pagination, stable occurrence/id ordering, batched enrichment, and
  budget access checks remain application responsibilities. Correlated
  subqueries use `.ref()` instead of assuming physical table names are aliases.
- `application/mappings/` derives runtime source schemas from `.rowSchema` and
  adds only application enrichment fields. Register mappings once per connection
  and use `getSyncMapper()` for pure transformations. Fetch enrichment first;
  keep `Promise.all` for independent I/O, not synchronous row conversion.
- Database metadata must reflect storage: amounts use `decimal(18, 2)`, rates
  use `decimal(18, 8)`, and rate dates use `date().dateOnly()`. These match the
  existing migrations. Database decimals are exact strings and dates are
  decoded `Date` values; DTO mappers explicitly retain numeric amounts/rates
  and `YYYY-MM-DD` rate dates. Nullable database fields are normalized only
  where public contracts require optional fields.
- Create PostgreSQL pools through `db/postgres.ts`. Its process-wide pg policy
  serializes Date parameters in UTC, preserving calendar dates even when the
  host process runs in another timezone; TIMESTAMPTZ instants are unchanged.
  CI runs the database suite in both its default and a non-UTC timezone.
- Plain schema-query writes must use storage-only schemas. Omit ORM navigation
  properties (for example, the tag link's `tag`) from write schemas so generated
  `RETURNING` columns cannot include relationships as physical columns.
- API-key listing projects only public fields, and filters owner/revocation in
  SQL. Avatar summaries exclude passwords and stored image bodies. Mapping
  metadata and synchronous conversion do not execute SQL.

Example: independently scoped reads and a reusable synchronous mapper:

```ts
const keys = await apiKeyRead(db.knex)
    .where(key => key.userId, userId)
    .whereNull(key => key.revokedAt)
    .orderBy(key => key.createdAt, 'desc');
return keys.map(apiKeyMapping(db.knex));
```

Keep `read-models.test.ts`, `typed-query-inference.test.ts`, and the real
PostgreSQL suite (`npm run test:queries:integration`) alongside unit tests.
The integration command requires `QUERY_TEST_DATABASE_URL` for a dedicated
`xpenser_queries` database and creates/drops its own random schema. It checks
decoded row schemas, isolated query branches, write/rollback behavior, safe
projections, page/count agreement, and bounded enrichment query counts.

## Cache Ownership

- Keep endpoint-specific cache namespaces in the shared contract. A vendor list
  and vendor detail have different response shapes and therefore use `vendors`
  and `vendor`; a write invalidates every affected namespace.
- Let Framework encode parameterized cache keys. The beta distinguishes Date
  values down to milliseconds and avoids separator collisions. Do not build a
  second encoder in Xpenser.
- `createXpenserClient()` creates its own in-memory cache middleware. Preserve
  the existing client/auth lifetimes and TTLs; do not share a private-data client
  across users or change its identity while keeping cached responses.
- Framework's external cache bridge handles its versioned parameterized tags.
  Next.js cache tags owned directly by Xpenser still use their existing literal
  names. Keep these invalidation paths distinct.
- Failed writes must preserve valid cache entries. A successful write must also
  stop an older in-flight read from repopulating an invalidated entry; keep both
  regressions in the client tests.

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
  `apps/api/src/api/implementation.test.ts`.
- Error-policy mapping, bound-handler HTTP behavior, and separate-file type
  inference tests under `apps/api/src/api`.
- Config guard tests for API, web, and Telegram bot production secrets.
- Client middleware tests for batching, retry, timeout, dedupe, cache tags, and
  tracing order.
- Form provider tests that prove Cleverbrush schema fields resolve to the
  expected xpenser UI controls.
- Form result/action tests in `apps/web/lib/form-*.test.ts`, custom-form
  rejection/retry tests, direct/batched HTTP validation tests, and
  `tests/e2e/form-validation.spec.ts` exercise the full validation boundary.
- E2E workflow tests for authenticated app behavior and preview validation.

## Adding New Features

1. Add or update the schema in `packages/contracts/src/schemas.ts`.
2. Add the endpoint to `packages/contracts/src/api.ts` with auth and cache tags.
3. Configure DI and OpenAPI metadata in the feature `scope.ts`.
4. Add `handlers/<operation>.ts` with `Handler<typeof scope.endpoints.operation>`
   (or `SubscriptionHandler`), then bind it in the feature `index.ts`. Reuse or
   extend a narrow `errors.ts` policy only for declared response cases. Add new
   feature modules to `implementation.ts`; typechecking enforces full coverage.
5. Use `createXpenserClient()` from server-side web code or external clients.
6. Add focused tests for schema validation, handler behavior, contract metadata,
   and any changed UI flow.
