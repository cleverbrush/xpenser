import knex from 'knex';
import { config } from '../config.js';
import { runMigrations } from './migrate.js';

const db = knex({
    client: 'pg',
    connection: config.db.connectionString,
    pool: { min: 1, max: 1 }
});

runMigrations(db)
    .finally(() => db.destroy())
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
