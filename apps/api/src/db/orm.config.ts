import { defineConfig } from '@cleverbrush/orm-cli';
import knex from 'knex';
import { config } from '../config.js';
import { migrationsDirectory } from './migrate.js';
import { entityMap } from './schemas.js';

const connection = knex({
    client: 'pg',
    connection: config.db.connectionString,
    pool: { min: 1, max: 1 }
});

export default defineConfig({
    knex: connection,
    entities: entityMap,
    migrations: {
        directory: migrationsDirectory,
        tableName: 'knex_migrations'
    }
});
