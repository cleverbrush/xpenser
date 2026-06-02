import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('categories', table => {
        table.timestamp('archived_at').nullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('categories', table => {
        table.dropColumn('archived_at');
    });
}
