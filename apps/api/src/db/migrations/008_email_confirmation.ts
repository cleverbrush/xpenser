import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('users', table => {
        table.boolean('email_verified').notNullable().defaultTo(false);
        table.string('email_verification_token_hash', 128).nullable().unique();
        table
            .timestamp('email_verification_expires_at', { useTz: true })
            .nullable();
    });

    await knex('users').update({ email_verified: true });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('users', table => {
        table.dropColumn('email_verification_expires_at');
        table.dropColumn('email_verification_token_hash');
        table.dropColumn('email_verified');
    });
}
