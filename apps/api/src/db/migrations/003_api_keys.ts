import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('api_keys', table => {
        table.increments('id').primary();
        table
            .integer('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table.string('name', 120).notNullable();
        table.string('key_id', 24).notNullable().unique();
        table.string('key_prefix', 32).notNullable();
        table.string('secret_hash', 64).notNullable();
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.timestamp('last_used_at', { useTz: true }).nullable();
        table.timestamp('revoked_at', { useTz: true }).nullable();
        table.index(['user_id'], 'idx_api_keys_user_id');
        table.index(['key_id'], 'idx_api_keys_key_id');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('api_keys');
}
