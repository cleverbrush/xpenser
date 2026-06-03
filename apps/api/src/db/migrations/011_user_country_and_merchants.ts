import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    const hasCountryCode = await knex.schema.hasColumn('users', 'country_code');

    if (!hasCountryCode) {
        await knex.schema.alterTable('users', table => {
            table.string('country_code', 2).nullable();
        });
        await knex('users')
            .whereNull('country_code')
            .update({ country_code: 'US' });
        await knex.raw(
            'alter table "users" alter column "country_code" set default \'US\''
        );
        await knex.raw(
            'alter table "users" alter column "country_code" set not null'
        );
    }

    const hasMerchants = await knex.schema.hasTable('merchants');
    if (!hasMerchants) {
        await knex.schema.createTable('merchants', table => {
            table.increments('id').primary();
            table
                .integer('user_id')
                .notNullable()
                .references('id')
                .inTable('users')
                .onDelete('CASCADE');
            table.string('name', 160).notNullable();
            table.string('normalized_name', 160).notNullable();
            table.string('brand_name', 160).nullable();
            table.string('domain', 255).nullable();
            table.string('description', 1000).nullable();
            table.string('logo_url', 1000).nullable();
            table.string('primary_color', 16).nullable();
            table.string('enrichment_provider', 50).nullable();
            table.string('enrichment_status', 50).nullable();
            table.timestamp('enriched_at', { useTz: true }).nullable();
            table
                .timestamp('created_at', { useTz: true })
                .notNullable()
                .defaultTo(knex.fn.now());
            table
                .timestamp('updated_at', { useTz: true })
                .notNullable()
                .defaultTo(knex.fn.now());
            table.index(['user_id'], 'idx_merchants_user_id');
        });
        await knex.raw(`
            create unique index if not exists uq_merchants_user_normalized_name_without_domain
            on merchants (user_id, normalized_name)
            where domain is null
        `);
        await knex.raw(`
            create unique index if not exists uq_merchants_user_normalized_name_domain
            on merchants (user_id, normalized_name, domain)
            where domain is not null
        `);
    }

    const hasMerchantId = await knex.schema.hasColumn(
        'transactions',
        'merchant_id'
    );

    if (!hasMerchantId) {
        await knex.schema.alterTable('transactions', table => {
            table
                .integer('merchant_id')
                .nullable()
                .references('id')
                .inTable('merchants')
                .onDelete('SET NULL');
            table.index(['merchant_id'], 'idx_transactions_merchant_id');
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    const hasMerchantId = await knex.schema.hasColumn(
        'transactions',
        'merchant_id'
    );
    if (hasMerchantId) {
        await knex.schema.alterTable('transactions', table => {
            table.dropIndex(['merchant_id'], 'idx_transactions_merchant_id');
            table.dropColumn('merchant_id');
        });
    }

    await knex.schema.dropTableIfExists('merchants');

    const hasCountryCode = await knex.schema.hasColumn('users', 'country_code');
    if (hasCountryCode) {
        await knex.schema.alterTable('users', table => {
            table.dropColumn('country_code');
        });
    }
}
