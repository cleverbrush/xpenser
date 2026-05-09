import path from 'node:path';
import type { Knex } from 'knex';
import knexFactory from 'knex';
import { config } from '../config.js';

const migrationsDirectory =
    process.env.MIGRATIONS_DIR ??
    (/^\/app(\/|$)/.test(process.cwd())
        ? '/app/migrations'
        : path.join(process.cwd(), 'src/db/migrations'));

export async function runMigrations(knex: Knex): Promise<void> {
    await knex.migrate.latest({
        directory: migrationsDirectory,
        tableName: 'knex_migrations',
        loadExtensions: ['.ts', '.js']
    });
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const db = knexFactory({
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
}
