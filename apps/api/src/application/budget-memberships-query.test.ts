import { createDb } from '@cleverbrush/orm';
import knexFactory from 'knex';
import { describe, expect, it } from 'vitest';
import { entityMap } from '../db/schemas.js';
import { budgetMembershipsForUser } from './budgets.js';

describe('budget membership database queries', () => {
    it('aliases included budget columns to their schema property names', async () => {
        const knex = knexFactory({ client: 'pg' });
        const db = createDb(knex, entityMap);

        const compiled = budgetMembershipsForUser(db, 7).toKnexQuery().toSQL();

        expect(compiled.sql).toContain(
            '"default_currency" as "defaultCurrency"'
        );
        expect(compiled.sql).toContain('"country_code" as "countryCode"');
        expect(compiled.sql).toContain('"created_at" as "createdAt"');
        expect(compiled.sql).toContain('"updated_at" as "updatedAt"');
        expect(compiled.sql).toContain('"user_id" = ?');
        expect(compiled.bindings).toContain(7);

        await knex.destroy();
    });
});
