# Database reads

## Compiled reads, not cached permissions

Feature-owned definitions in `budget-access-reads.ts`, `api-key-reads.ts`,
`budget-queries.ts`, and `jobs/scan-reads.ts` use `query(Schema)` and
`parameter(...)` at module scope, without a database connection. Supply the
injected connection or caller-owned transaction when executing them. Framework
weakly caches compiled SQL per actual Knex instance; the application does not
need its own connection cache. Every invocation reads fresh data with independent
bindings. Revoking a key or budget membership takes effect on the next request.

```ts
const [member] = await budgetAccessReads.member(db.knex, budgetId, userId);
// Debug SQL without executing:
const { sql, bindings } = budgetAccessReads.member.toSQL(
    db.knex, budgetId, userId
);
// Inside a caller-owned transaction:
const [transactionMember] = await budgetAccessReads.member(
    transaction.knex, budgetId, userId
);
```

Reusable projections expose `rowSchema` before a connection exists. Mapping
schemas and synchronous DTO mappers are prepared once at module scope; mapping a
row never needs Knex or performs SQL. For example, `apiKeyRead.rowSchema` supplies
the public API-key projection and `apiKeyMapping(row)` maps its decoded result.

Bind a definition with `.query(knex, ...parameters)` when adding request-specific
filters, pagination, or native SQL. This creates an independent immutable reader;
count/page branches and different tenants cannot change the shared definition.
Bind before using `.ref()`, native Knex subqueries, or `.transacting(trx)`.

```ts
const pageSource = transactionListRead.query(db.knex)
    .where(t => t.transactions.budgetId, budgetId);
```

Dynamic report filters, variable-size ID lists, ad-hoc queries and ORM writes keep
ordinary immutable builders. No result cache or new database connection is
introduced. A definition is not thenable: execute it with a connection rather
than awaiting the definition itself.

## Verification

Feature-owned PostgreSQL suites cover the read behavior:
`apps/api/integration/budget-access.test.ts` checks concurrent bindings, fresh
membership checks, separate connection configurations, and transaction rollback;
`api-keys.test.ts` checks revocation;
`transaction-scans.test.ts` checks progress projections and stored result decoding.
Run `npm run test:queries:integration` against the dedicated test database.

Pinned library versions and general integration patterns are documented in
[the Cleverbrush reference](./cleverbrush-reference.md).
