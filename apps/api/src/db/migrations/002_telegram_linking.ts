import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('telegram_accounts', table => {
        table
            .integer('user_id')
            .notNullable()
            .primary()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table.string('telegram_user_id', 64).notNullable().unique();
        table.string('telegram_username', 64).nullable();
        table.string('telegram_first_name', 128).nullable();
        table.string('telegram_last_name', 128).nullable();
        table
            .timestamp('linked_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table
            .timestamp('updated_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.index(
            ['telegram_user_id'],
            'idx_telegram_accounts_telegram_user_id'
        );
    });

    await knex.schema.createTable('telegram_link_tokens', table => {
        table.increments('id').primary();
        table
            .integer('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table.string('token_hash', 64).notNullable().unique();
        table.timestamp('expires_at', { useTz: true }).notNullable();
        table.timestamp('consumed_at', { useTz: true }).nullable();
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.index(['user_id'], 'idx_telegram_link_tokens_user_id');
        table.index(['expires_at'], 'idx_telegram_link_tokens_expires_at');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('telegram_link_tokens');
    await knex.schema.dropTableIfExists('telegram_accounts');
}
