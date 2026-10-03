import { beforeAll, describe, expect, it } from 'vitest';
import {
    authenticateApiKey,
    createApiKey,
    revokeApiKey
} from '../src/application/api-keys.js';
import { postgresFixture, seedBudgetOwners } from './postgres-fixture.js';

const { db, knex } = postgresFixture('api_keys');
beforeAll(() => seedBudgetOwners(knex));

describe('API-key authentication on PostgreSQL', () => {
    it('does not cache authentication results after revocation', async () => {
        const key = await createApiKey(db, 1, { name: 'Compiled auth' });
        expect((await authenticateApiKey(db, key.key))?.userId).toBe(1);
        await revokeApiKey(db, 1, key.apiKey.id);
        expect(await authenticateApiKey(db, key.key)).toBeUndefined();
    });
});
