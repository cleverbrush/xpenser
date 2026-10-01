import { defineConfig } from '@cleverbrush/orm-cli';
import { config } from '../config.js';
import { migrationsDirectory } from './migrate.js';
import { createPostgresConnection } from './postgres.js';
import { entityMap } from './schemas.js';

const connection = createPostgresConnection({
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
