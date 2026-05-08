import knex from 'knex';
import { defineConfig } from '@cleverbrush/orm-cli';
import { entityMap } from './src/db/schemas.js';

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'xpenser_db',
    user: process.env.DB_USER ?? 'xpenser_user',
    password: process.env.DB_PASSWORD ?? 'xpenser_secret',
  },
});

export default defineConfig({
  knex: db,
  entities: entityMap,
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
});
