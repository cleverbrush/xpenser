import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('budgets', table => {
        table.timestamp('archived_at', { useTz: true }).nullable();
        table.index(['archived_at'], 'idx_budgets_archived_at');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('budgets', table => {
        table.dropIndex(['archived_at'], 'idx_budgets_archived_at');
        table.dropColumn('archived_at');
    });
}
