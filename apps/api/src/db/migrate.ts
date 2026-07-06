import path from 'node:path';
import type { Knex } from 'knex';

export const migrationsDirectory =
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
