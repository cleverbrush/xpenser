import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('users', table => {
        table.increments('id').primary();
        table.string('email', 255).notNullable().unique();
        table.string('password_hash', 512).nullable();
        table.string('role', 50).notNullable().defaultTo('user');
        table.string('auth_provider', 50).notNullable().defaultTo('local');
        table.string('default_currency', 3).notNullable().defaultTo('USD');
        table.string('timezone', 64).notNullable().defaultTo('UTC');
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table
            .timestamp('updated_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('user_favorite_currencies', table => {
        table
            .integer('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table.string('currency', 3).notNullable();
        table.primary(['user_id', 'currency']);
    });

    await knex.schema.createTable('categories', table => {
        table.increments('id').primary();
        table
            .integer('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table.string('name', 120).notNullable();
        table.string('type', 20).notNullable();
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table
            .timestamp('updated_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.unique(['user_id', 'type', 'name'], {
            indexName: 'uq_categories_user_type_name'
        });
        table.index(['user_id'], 'idx_categories_user_id');
    });

    await knex.schema.createTable('exchange_rates', table => {
        table.increments('id').primary();
        table.string('base_currency', 3).notNullable();
        table.string('quote_currency', 3).notNullable();
        table.date('rate_date').notNullable();
        table.decimal('rate', 18, 8).notNullable();
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.unique(['base_currency', 'quote_currency', 'rate_date'], {
            indexName: 'uq_exchange_rates_pair_date'
        });
    });

    await knex.schema.createTable('transactions', table => {
        table.increments('id').primary();
        table
            .integer('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table
            .integer('category_id')
            .notNullable()
            .references('id')
            .inTable('categories')
            .onDelete('RESTRICT');
        table.string('type', 20).notNullable();
        table.decimal('amount', 18, 2).notNullable();
        table.string('currency', 3).notNullable();
        table.decimal('default_currency_amount', 18, 2).notNullable();
        table.string('default_currency', 3).notNullable();
        table.decimal('exchange_rate', 18, 8).notNullable();
        table.date('exchange_rate_date').notNullable();
        table.timestamp('occurred_at', { useTz: true }).notNullable();
        table.string('note', 500).nullable();
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table
            .timestamp('updated_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.index(
            ['user_id', 'occurred_at'],
            'idx_transactions_user_occurred'
        );
        table.index(['category_id'], 'idx_transactions_category_id');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('transactions');
    await knex.schema.dropTableIfExists('exchange_rates');
    await knex.schema.dropTableIfExists('categories');
    await knex.schema.dropTableIfExists('user_favorite_currencies');
    await knex.schema.dropTableIfExists('users');
}
