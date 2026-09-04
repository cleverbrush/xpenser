import knexFactory from 'knex';
import { describe, expect, it } from 'vitest';
import { transactionTagListQuery } from './transaction-tags.js';

describe('transaction tag database queries', () => {
    it('builds a schema-aware list query with mapped link columns', () => {
        const knex = knexFactory({ client: 'pg' });
        const compiled = transactionTagListQuery(knex, 3, 'travel', 25).toSQL();

        expect(compiled.sql).toContain('from "transaction_tags"');
        expect(compiled.sql).toContain('"budget_id" = ?');
        expect(compiled.sql).toContain(
            '"transaction_tag_links"."tag_id" = "transaction_tags"."id"'
        );
        expect(compiled.sql).toContain('"name" ilike ?');
        expect(compiled.bindings).toContain('%travel%');
    });
});
