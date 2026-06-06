import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('mcp_oauth_clients', table => {
        table.increments('id').primary();
        table.string('client_id', 80).notNullable().unique();
        table.string('client_name', 200).notNullable();
        table.text('redirect_uris_json').notNullable();
        table.string('scope', 120).notNullable().defaultTo('mcp');
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.index(['client_id'], 'idx_mcp_oauth_clients_client_id');
    });

    await knex.schema.createTable('mcp_oauth_grants', table => {
        table.increments('id').primary();
        table
            .integer('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table
            .integer('client_id')
            .notNullable()
            .references('id')
            .inTable('mcp_oauth_clients')
            .onDelete('CASCADE');
        table.string('scope', 120).notNullable().defaultTo('mcp');
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.timestamp('last_used_at', { useTz: true }).nullable();
        table.timestamp('revoked_at', { useTz: true }).nullable();
        table.index(['user_id'], 'idx_mcp_oauth_grants_user_id');
        table.index(['client_id'], 'idx_mcp_oauth_grants_client_id');
    });

    await knex.schema.createTable('mcp_oauth_authorization_codes', table => {
        table.increments('id').primary();
        table.string('code_hash', 64).notNullable().unique();
        table
            .integer('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table
            .integer('client_id')
            .notNullable()
            .references('id')
            .inTable('mcp_oauth_clients')
            .onDelete('CASCADE');
        table
            .integer('grant_id')
            .notNullable()
            .references('id')
            .inTable('mcp_oauth_grants')
            .onDelete('CASCADE');
        table.text('redirect_uri').notNullable();
        table.string('code_challenge', 160).notNullable();
        table.string('code_challenge_method', 16).notNullable();
        table.string('scope', 120).notNullable().defaultTo('mcp');
        table.timestamp('expires_at', { useTz: true }).notNullable();
        table.timestamp('consumed_at', { useTz: true }).nullable();
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.index(
            ['code_hash'],
            'idx_mcp_oauth_authorization_codes_code_hash'
        );
    });

    await knex.schema.createTable('mcp_oauth_refresh_tokens', table => {
        table.increments('id').primary();
        table.string('token_hash', 64).notNullable().unique();
        table
            .integer('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table
            .integer('client_id')
            .notNullable()
            .references('id')
            .inTable('mcp_oauth_clients')
            .onDelete('CASCADE');
        table
            .integer('grant_id')
            .notNullable()
            .references('id')
            .inTable('mcp_oauth_grants')
            .onDelete('CASCADE');
        table.timestamp('expires_at', { useTz: true }).notNullable();
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.timestamp('last_used_at', { useTz: true }).nullable();
        table.timestamp('revoked_at', { useTz: true }).nullable();
        table.index(['token_hash'], 'idx_mcp_oauth_refresh_tokens_token_hash');
        table.index(['grant_id'], 'idx_mcp_oauth_refresh_tokens_grant_id');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('mcp_oauth_refresh_tokens');
    await knex.schema.dropTableIfExists('mcp_oauth_authorization_codes');
    await knex.schema.dropTableIfExists('mcp_oauth_grants');
    await knex.schema.dropTableIfExists('mcp_oauth_clients');
}
