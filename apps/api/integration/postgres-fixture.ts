import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { createDb } from '@cleverbrush/orm';
import type { Knex } from 'knex';
import { afterAll, beforeAll } from 'vitest';
import { createPostgresConnection } from '../src/db/postgres.js';
import { entityMap } from '../src/db/schemas.js';

/** Register a migrated, isolated schema for one feature's PostgreSQL suite. */
export function postgresFixture(feature: string) {
    const connection = process.env.QUERY_TEST_DATABASE_URL;
    if (!connection || new URL(connection).pathname !== '/xpenser_queries') {
        throw new Error('Use a dedicated xpenser_queries database');
    }
    const schema = feature + '_' + randomUUID().replaceAll('-', '');
    const knex = createPostgresConnection({
        connection,
        searchPath: [schema],
        pool: { min: 0, max: 4 }
    });
    const db = createDb(knex, entityMap);
    let created = false;

    beforeAll(async () => {
        await knex.schema.createSchema(schema);
        created = true;
        const directory = new URL('../src/db/migrations/', import.meta.url);
        for (const file of readdirSync(directory)
            .filter(file => file.endsWith('.ts'))
            .sort()) {
            await (await import(new URL(file, directory).href)).up(knex);
        }
    });
    afterAll(async () => {
        try {
            if (created) await knex.schema.dropSchema(schema, true);
        } finally {
            await knex.destroy();
        }
    });
    return { db, knex };
}

/** Two unrelated budget owners for access/isolation assertions. */
export async function seedBudgetOwners(knex: Knex) {
    await knex('users').insert([
        { id: 1, email: 'one@example.test' },
        { id: 2, email: 'two@example.test' }
    ]);
    await knex('budgets').insert([
        { id: 1, name: 'One', default_currency: 'USD', created_by_user_id: 1 },
        { id: 2, name: 'Two', default_currency: 'USD', created_by_user_id: 2 }
    ]);
    await knex('budget_members').insert([
        { budget_id: 1, user_id: 1, display_name: 'One', role: 'admin' },
        { budget_id: 2, user_id: 2, display_name: 'Two', role: 'admin' }
    ]);
}
