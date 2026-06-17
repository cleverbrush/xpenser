import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('cash_flow_forecasts', table => {
        table.increments('id').primary();
        table
            .integer('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table.date('forecast_date').notNullable();
        table.string('forecast_version', 32).notNullable();
        table.string('input_hash', 128).notNullable();
        table.string('model', 128).notNullable();
        table.string('status', 32).notNullable();
        table.text('forecast_json').notNullable();
        table.text('error_message');
        table.timestamp('generated_at');
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

        table.unique(
            ['user_id', 'forecast_date', 'forecast_version'],
            'uq_cash_flow_forecasts_user_date_version'
        );
        table.index(
            ['user_id', 'forecast_date'],
            'idx_cash_flow_forecasts_user_date'
        );
        table.index(['status'], 'idx_cash_flow_forecasts_status');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('cash_flow_forecasts');
}
