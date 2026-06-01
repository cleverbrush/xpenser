import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('users', table => {
        table
            .boolean('weekly_email_report_enabled')
            .notNullable()
            .defaultTo(true);
        table
            .boolean('monthly_email_report_enabled')
            .notNullable()
            .defaultTo(true);
    });

    await knex.schema.createTable('email_report_deliveries', table => {
        table.increments('id').primary();
        table
            .integer('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table.string('delivery_key', 255).notNullable().unique();
        table.string('report_type', 20).notNullable();
        table.string('trigger', 20).notNullable();
        table.timestamp('period_start', { useTz: true }).notNullable();
        table.timestamp('period_end', { useTz: true }).notNullable();
        table.string('recipient_email', 255).notNullable();
        table.string('status', 20).notNullable().defaultTo('pending');
        table.integer('attempts').notNullable().defaultTo(1);
        table.text('last_error').nullable();
        table.string('provider_message_id', 255).nullable();
        table.timestamp('sent_at', { useTz: true }).nullable();
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table
            .timestamp('updated_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.index(['user_id', 'report_type'], 'idx_email_reports_user_type');
        table.index(['status'], 'idx_email_reports_status');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('email_report_deliveries');
    await knex.schema.alterTable('users', table => {
        table.dropColumn('monthly_email_report_enabled');
        table.dropColumn('weekly_email_report_enabled');
    });
}
