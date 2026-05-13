import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('transactions', table => {
        table.string('effect', 20).notNullable().defaultTo('normal');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('transactions', table => {
        table.dropColumn('effect');
    });
}
