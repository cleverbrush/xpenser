import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 512).nullable();
    table.string('role', 50).notNullable().defaultTo('user');
    table.string('auth_provider', 50).notNullable().defaultTo('local');
    table.string('default_currency', 3).notNullable().defaultTo('USD');
    table.jsonb('favorite_currencies').notNullable().defaultTo('[]');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('categories', (table) => {
    table.increments('id').primary();
    table
      .integer('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.string('type', 10).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['user_id'], 'idx_categories_user_id');
  });

  await knex.schema.createTable('transactions', (table) => {
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
    table.decimal('amount', 12, 2).notNullable();
    table.string('currency', 3).notNullable();
    table.text('description').nullable();
    table.timestamp('transaction_date', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['user_id'], 'idx_transactions_user_id');
    table.index(['category_id'], 'idx_transactions_category_id');
    table.index(['transaction_date'], 'idx_transactions_transaction_date');
  });

  await knex.schema.createTable('exchange_rates', (table) => {
    table.increments('id').primary();
    table.string('base_currency', 3).notNullable();
    table.string('target_currency', 3).notNullable();
    table.decimal('rate', 18, 8).notNullable();
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['base_currency', 'target_currency']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('exchange_rates');
  await knex.schema.dropTableIfExists('transactions');
  await knex.schema.dropTableIfExists('categories');
  await knex.schema.dropTableIfExists('users');
}
