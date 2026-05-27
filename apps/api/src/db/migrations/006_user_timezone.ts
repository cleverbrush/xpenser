import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    const hasTimezone = await knex.schema.hasColumn('users', 'timezone');

    if (hasTimezone) {
        await knex('users').whereNull('timezone').update({ timezone: 'UTC' });
        await knex.raw(
            'alter table "users" alter column "timezone" set default \'UTC\''
        );
        await knex.raw(
            'alter table "users" alter column "timezone" set not null'
        );
        return;
    }

    await knex.schema.alterTable('users', table => {
        table.string('timezone', 64).notNullable().defaultTo('UTC');
    });
}

export async function down(knex: Knex): Promise<void> {
    const hasTimezone = await knex.schema.hasColumn('users', 'timezone');

    if (!hasTimezone) {
        return;
    }

    await knex.schema.alterTable('users', table => {
        table.dropColumn('timezone');
    });
}
