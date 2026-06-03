import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.raw(
        'alter table merchants drop constraint if exists uq_merchants_user_normalized_name'
    );
    await knex.raw('drop index if exists uq_merchants_user_normalized_name');
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

export async function down(knex: Knex): Promise<void> {
    await knex.raw(
        'drop index if exists uq_merchants_user_normalized_name_domain'
    );
    await knex.raw(
        'drop index if exists uq_merchants_user_normalized_name_without_domain'
    );
    await knex.raw(`
        create unique index if not exists uq_merchants_user_normalized_name
        on merchants (user_id, normalized_name)
    `);
}
