import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('external_identities', table => {
        table.string('provider', 50).notNullable();
        table.string('provider_subject', 255).notNullable();
        table
            .integer('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table.string('email', 255).notNullable();
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.primary(['provider', 'provider_subject']);
        table.unique(['provider', 'user_id'], {
            indexName: 'uq_external_identities_provider_user'
        });
        table.index(['user_id'], 'idx_external_identities_user_id');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('external_identities');
}
