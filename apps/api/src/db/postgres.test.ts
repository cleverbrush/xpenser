import pg from 'pg';
import { expect, it } from 'vitest';
import { createPostgresConnection } from './postgres.js';

it('uses PostgreSQL with UTC Date encoding and preserves pool configuration', async () => {
    const previous = pg.defaults.parseInputDatesAsUTC;
    pg.defaults.parseInputDatesAsUTC = false;
    const connection = createPostgresConnection({ pool: { min: 0, max: 2 } });
    try {
        expect(pg.defaults.parseInputDatesAsUTC).toBe(true);
        expect(connection.client.config.client).toBe('pg');
        expect(connection.client.config.pool).toMatchObject({ min: 0, max: 2 });
    } finally {
        await connection.destroy();
        pg.defaults.parseInputDatesAsUTC = previous;
    }
});
