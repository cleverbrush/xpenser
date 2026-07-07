import type { Knex } from 'knex';

const budgetScopedTables = [
    'categories',
    'vendors',
    'transactions',
    'transaction_tags',
    'transaction_scans',
    'transaction_scan_items',
    'transaction_scan_images'
] as const;

async function addBudgetColumn(knex: Knex, tableName: string): Promise<void> {
    await knex.schema.alterTable(tableName, table => {
        table
            .integer('budget_id')
            .nullable()
            .references('id')
            .inTable('budgets')
            .onDelete('CASCADE');
        table.index(['budget_id'], `idx_${tableName}_budget_id`);
    });
}

async function requireBudgetColumn(
    knex: Knex,
    tableName: string
): Promise<void> {
    await knex.raw(`alter table ?? alter column budget_id set not null`, [
        tableName
    ]);
}

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('budgets', table => {
        table.increments('id').primary();
        table.string('name', 120).notNullable();
        table.string('default_currency', 3).notNullable();
        table.string('country_code', 2).notNullable().defaultTo('US');
        table
            .integer('created_by_user_id')
            .nullable()
            .references('id')
            .inTable('users')
            .onDelete('SET NULL');
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table
            .timestamp('updated_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.index(['created_by_user_id'], 'idx_budgets_created_by_user_id');
    });

    await knex.schema.alterTable('users', table => {
        table
            .integer('main_budget_id')
            .nullable()
            .references('id')
            .inTable('budgets')
            .onDelete('SET NULL');
        table.index(['main_budget_id'], 'idx_users_main_budget_id');
    });

    await knex.schema.createTable('budget_members', table => {
        table
            .integer('budget_id')
            .notNullable()
            .references('id')
            .inTable('budgets')
            .onDelete('CASCADE');
        table
            .integer('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table.string('display_name', 120).notNullable();
        table.string('role', 32).notNullable();
        table.boolean('can_create_transactions').notNullable().defaultTo(true);
        table.boolean('can_update_transactions').notNullable().defaultTo(false);
        table.boolean('can_delete_transactions').notNullable().defaultTo(false);
        table.boolean('can_manage_categories').notNullable().defaultTo(false);
        table.boolean('can_manage_vendors').notNullable().defaultTo(false);
        table.boolean('can_manage_tags').notNullable().defaultTo(false);
        table.boolean('can_manage_members').notNullable().defaultTo(false);
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table
            .timestamp('updated_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.primary(['budget_id', 'user_id'], {
            constraintName: 'pk_budget_members'
        });
        table.index(['user_id'], 'idx_budget_members_user_id');
    });

    await knex.schema.createTable('budget_favorite_currencies', table => {
        table
            .integer('budget_id')
            .notNullable()
            .references('id')
            .inTable('budgets')
            .onDelete('CASCADE');
        table.string('currency', 3).notNullable();
        table.primary(['budget_id', 'currency'], {
            constraintName: 'pk_budget_favorite_currencies'
        });
    });

    await knex.schema.createTable('budget_invitations', table => {
        table.increments('id').primary();
        table
            .integer('budget_id')
            .notNullable()
            .references('id')
            .inTable('budgets')
            .onDelete('CASCADE');
        table
            .integer('invited_by_user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table.string('email', 255).notNullable();
        table.string('role', 32).notNullable();
        table.boolean('can_create_transactions').notNullable().defaultTo(true);
        table.boolean('can_update_transactions').notNullable().defaultTo(false);
        table.boolean('can_delete_transactions').notNullable().defaultTo(false);
        table.boolean('can_manage_categories').notNullable().defaultTo(false);
        table.boolean('can_manage_vendors').notNullable().defaultTo(false);
        table.boolean('can_manage_tags').notNullable().defaultTo(false);
        table.boolean('can_manage_members').notNullable().defaultTo(false);
        table.string('token_hash', 128).notNullable().unique();
        table.timestamp('expires_at', { useTz: true }).notNullable();
        table.timestamp('consumed_at', { useTz: true }).nullable();
        table
            .timestamp('created_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table
            .timestamp('updated_at', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.index(['budget_id'], 'idx_budget_invitations_budget_id');
        table.index(['email'], 'idx_budget_invitations_email');
        table.index(['token_hash'], 'idx_budget_invitations_token_hash');
    });

    await knex.raw(`
        insert into budgets (name, default_currency, country_code, created_by_user_id)
        select 'Main', default_currency, coalesce(country_code, 'US'), id
        from users
    `);

    await knex.raw(`
        update users u
        set main_budget_id = b.id
        from budgets b
        where b.created_by_user_id = u.id
          and b.name = 'Main'
    `);

    await knex.raw(`
        insert into budget_members (
            budget_id,
            user_id,
            display_name,
            role,
            can_create_transactions,
            can_update_transactions,
            can_delete_transactions,
            can_manage_categories,
            can_manage_vendors,
            can_manage_tags,
            can_manage_members
        )
        select
            main_budget_id,
            id,
            'Main',
            'admin',
            true,
            true,
            true,
            true,
            true,
            true,
            true
        from users
        where main_budget_id is not null
    `);

    await knex.raw(`
        insert into budget_favorite_currencies (budget_id, currency)
        select distinct u.main_budget_id, currency.currency
        from user_favorite_currencies currency
        join users u on u.id = currency.user_id
        where u.main_budget_id is not null
    `);

    await knex.schema.dropTableIfExists('user_favorite_currencies');

    for (const tableName of budgetScopedTables) {
        await addBudgetColumn(knex, tableName);
    }

    for (const tableName of budgetScopedTables) {
        await knex.raw(
            `
            update ?? as scoped
            set budget_id = u.main_budget_id
            from users u
            where scoped.user_id = u.id
        `,
            [tableName]
        );
        await requireBudgetColumn(knex, tableName);
    }

    await knex.schema.alterTable('email_report_deliveries', table => {
        table
            .integer('budget_id')
            .nullable()
            .references('id')
            .inTable('budgets')
            .onDelete('CASCADE');
        table.index(['budget_id'], 'idx_email_reports_budget_id');
        table.index(
            ['user_id', 'budget_id', 'report_type'],
            'idx_email_reports_user_budget_type'
        );
    });
    await knex.raw(`
        update email_report_deliveries as delivery
        set budget_id = u.main_budget_id
        from users u
        where delivery.user_id = u.id
    `);
    await knex.raw(`
        update email_report_deliveries
        set delivery_key = concat(
            user_id,
            ':',
            budget_id,
            ':',
            report_type,
            ':',
            to_char(
                period_start at time zone 'UTC',
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            )
        )
        where budget_id is not null
    `);
    await knex.raw(
        'alter table email_report_deliveries alter column budget_id set not null'
    );

    await knex.raw('drop index if exists uq_categories_user_type_parent_name');
    await knex.raw('drop index if exists uq_categories_user_type_top_name');
    await knex.raw(`
        create unique index uq_categories_budget_type_top_name
        on categories (budget_id, type, name)
        where parent_id is null
    `);
    await knex.raw(`
        create unique index uq_categories_budget_type_parent_name
        on categories (budget_id, type, parent_id, name)
        where parent_id is not null
    `);

    await knex.raw(
        'drop index if exists uq_vendors_user_normalized_name_domain'
    );
    await knex.raw(
        'drop index if exists uq_vendors_user_normalized_name_without_domain'
    );
    await knex.raw(`
        create unique index uq_vendors_budget_normalized_name_without_domain
        on vendors (budget_id, normalized_name)
        where domain is null
    `);
    await knex.raw(`
        create unique index uq_vendors_budget_normalized_name_domain
        on vendors (budget_id, normalized_name, domain)
        where domain is not null
    `);

    await knex.raw(
        'alter table transaction_tags drop constraint if exists uq_transaction_tags_user_normalized_name'
    );
    await knex.raw(
        'drop index if exists uq_transaction_tags_user_normalized_name'
    );
    await knex.raw(`
        create unique index uq_transaction_tags_budget_normalized_name
        on transaction_tags (budget_id, normalized_name)
    `);

    await knex.schema.alterTable('transactions', table => {
        table.index(
            ['budget_id', 'occurred_at'],
            'idx_transactions_budget_occurred'
        );
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.raw('drop index if exists idx_transactions_budget_occurred');
    await knex.raw(
        'drop index if exists uq_transaction_tags_budget_normalized_name'
    );
    await knex.raw(
        'drop index if exists uq_vendors_budget_normalized_name_domain'
    );
    await knex.raw(
        'drop index if exists uq_vendors_budget_normalized_name_without_domain'
    );
    await knex.raw(
        'drop index if exists uq_categories_budget_type_parent_name'
    );
    await knex.raw('drop index if exists uq_categories_budget_type_top_name');

    await knex.raw(`
        create unique index if not exists uq_categories_user_type_top_name
        on categories (user_id, type, name)
        where parent_id is null
    `);
    await knex.raw(`
        create unique index if not exists uq_categories_user_type_parent_name
        on categories (user_id, type, parent_id, name)
        where parent_id is not null
    `);
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
    await knex.raw(`
        create unique index if not exists uq_transaction_tags_user_normalized_name
        on transaction_tags (user_id, normalized_name)
    `);

    for (const tableName of [...budgetScopedTables].reverse()) {
        await knex.schema.alterTable(tableName, table => {
            table.dropIndex(['budget_id'], `idx_${tableName}_budget_id`);
            table.dropColumn('budget_id');
        });
    }

    await knex.schema.alterTable('email_report_deliveries', table => {
        table.dropIndex(
            ['user_id', 'budget_id', 'report_type'],
            'idx_email_reports_user_budget_type'
        );
        table.dropIndex(['budget_id'], 'idx_email_reports_budget_id');
        table.dropColumn('budget_id');
    });

    await knex.schema.dropTableIfExists('budget_invitations');
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
    await knex.raw(`
        insert into user_favorite_currencies (user_id, currency)
        select distinct u.id, currency.currency
        from users u
        join budget_favorite_currencies currency
          on currency.budget_id = u.main_budget_id
        where u.main_budget_id is not null
    `);
    await knex.schema.dropTableIfExists('budget_favorite_currencies');
    await knex.schema.dropTableIfExists('budget_members');

    await knex.schema.alterTable('users', table => {
        table.dropIndex(['main_budget_id'], 'idx_users_main_budget_id');
        table.dropColumn('main_budget_id');
    });

    await knex.schema.dropTableIfExists('budgets');
}
