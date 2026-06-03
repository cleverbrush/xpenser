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

    const hasVendors = await knex.schema.hasTable('vendors');
    if (!hasVendors) {
        await knex.schema.createTable('vendors', table => {
            table.increments('id').primary();
            table
                .integer('user_id')
                .notNullable()
                .references('id')
                .inTable('users')
                .onDelete('CASCADE');
            table.string('name', 160).notNullable();
            table.string('normalized_name', 160).notNullable();
            table.string('resolved_name', 160).nullable();
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
            table.index(['user_id'], 'idx_vendors_user_id');
        });
        await knex.raw(`
            create unique index if not exists uq_vendors_user_normalized_name_without_domain
            on vendors (user_id, normalized_name)
            where domain is null
        `);
        await knex.raw(`
            create unique index if not exists uq_vendors_user_normalized_name_domain
            on vendors (user_id, normalized_name, domain)
            where domain is not null
        `);
    }

    const hasVendorId = await knex.schema.hasColumn(
        'transactions',
        'vendor_id'
    );

    if (!hasVendorId) {
        await knex.schema.alterTable('transactions', table => {
            table
                .integer('vendor_id')
                .nullable()
                .references('id')
                .inTable('vendors')
                .onDelete('SET NULL');
            table.index(['vendor_id'], 'idx_transactions_vendor_id');
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    const hasVendorId = await knex.schema.hasColumn(
        'transactions',
        'vendor_id'
    );
    if (hasVendorId) {
        await knex.schema.alterTable('transactions', table => {
            table.dropIndex(['vendor_id'], 'idx_transactions_vendor_id');
            table.dropColumn('vendor_id');
        });
    }

    await knex.schema.dropTableIfExists('vendors');

    const hasCountryCode = await knex.schema.hasColumn('users', 'country_code');
    if (hasCountryCode) {
        await knex.schema.alterTable('users', table => {
            table.dropColumn('country_code');
        });
    }
}
