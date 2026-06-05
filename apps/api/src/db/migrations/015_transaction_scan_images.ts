import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('transaction_scan_images', table => {
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
        table.string('image_hash', 128).notNullable();
        table.string('mime_type', 64).notNullable();
        table.text('file_name');
        table.integer('size_bytes').notNullable();
        table.text('image_base64').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

        table.unique(['scan_id'], {
            indexName: 'uq_transaction_scan_images_scan_id'
        });
        table.index(['user_id'], 'idx_transaction_scan_images_user_id');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('transaction_scan_images');
}
