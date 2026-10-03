# Database reads

## Compiled reads, not cached permissions

Feature-owned definitions in `budget-access-reads.ts`, `api-key-reads.ts`,
`budget-queries.ts`, and `jobs/scan-reads.ts` use `parameter(...)`. `perConnection`
retains immutable query definitions weakly by Knex connection. Direct calls reuse
compiled SQL and result decoding, but every invocation executes fresh database
reads with independent bindings. Revoking a key or budget membership takes effect
on the next request. Transaction-scoped connections use their own definitions;
explicit `.transacting(trx)` derivatives remain in the caller's transaction.

```ts
const reads = budgetAccessReads(db.knex);
const [member] = await reads.member(budgetId, userId);
// Debug SQL without executing:
const { sql, bindings } = reads.member.toSQL(budgetId, userId);
```

Dynamic report filters, variable-size ID lists, and writes keep ordinary immutable
query builders. No response cache, schema hierarchy, or polymorphic entity is
introduced to make use of an unrelated library feature.

## Verification

Feature-owned PostgreSQL suites cover the read behavior:
`apps/api/integration/budget-access.test.ts` checks concurrent bindings, fresh
membership checks, and transaction rollback; `api-keys.test.ts` checks revocation;
`transaction-scans.test.ts` checks progress projections and stored result decoding.
Run `npm run test:queries:integration` against the dedicated test database.

Pinned library versions and general integration patterns are documented in
[the Cleverbrush reference](./cleverbrush-reference.md).
