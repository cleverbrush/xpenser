import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('transaction_scans', table => {
        table.increments('id').primary();
        table
            .integer('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table.string('document_kind', 32).notNullable();
        table.string('image_hash', 128).notNullable();
        table.string('model', 128).notNullable();
        table.text('warnings_json').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

        table.index(['user_id'], 'idx_transaction_scans_user_id');
        table.index(['user_id', 'created_at'], 'idx_transaction_scans_recent');
    });

    await knex.schema.createTable('transaction_scan_items', table => {
        table.increments('id').primary();
        table
            .integer('scan_id')
            .notNullable()
            .references('id')
            .inTable('transaction_scans')
            .onDelete('CASCADE');
        table
            .integer('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table.text('draft_json').notNullable();
        table.string('decision', 32);
        table.text('corrected_json');
        table
            .integer('transaction_id')
            .references('id')
            .inTable('transactions')
            .onDelete('SET NULL');
        table
            .integer('created_category_id')
            .references('id')
            .inTable('categories')
            .onDelete('SET NULL');
        table
            .integer('created_vendor_id')
            .references('id')
            .inTable('vendors')
            .onDelete('SET NULL');
        table.timestamp('decided_at');
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

        table.index(['scan_id'], 'idx_transaction_scan_items_scan_id');
        table.index(['user_id'], 'idx_transaction_scan_items_user_id');
        table.index(
            ['user_id', 'decided_at'],
            'idx_transaction_scan_items_recent_decisions'
        );
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('transaction_scan_items');
    await knex.schema.dropTableIfExists('transaction_scans');
}
