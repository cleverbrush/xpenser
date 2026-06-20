import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('transaction_tags', table => {
        table.increments('id').primary();
        table
            .integer('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table.string('name', 60).notNullable();
        table.string('normalized_name', 60).notNullable();
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table
            .timestamp('updated_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.unique(['user_id', 'normalized_name'], {
            indexName: 'uq_transaction_tags_user_normalized_name'
        });
        table.index(['user_id'], 'idx_transaction_tags_user_id');
    });

    await knex.schema.createTable('transaction_tag_links', table => {
        table
            .integer('transaction_id')
            .notNullable()
            .references('id')
            .inTable('transactions')
            .onDelete('CASCADE');
        table
            .integer('tag_id')
            .notNullable()
            .references('id')
            .inTable('transaction_tags')
            .onDelete('CASCADE');
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.primary(['transaction_id', 'tag_id'], {
            constraintName: 'pk_transaction_tag_links'
        });
        table.index(['tag_id'], 'idx_transaction_tag_links_tag_id');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('transaction_tag_links');
    await knex.schema.dropTableIfExists('transaction_tags');
}
