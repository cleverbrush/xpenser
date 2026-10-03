import type { Knex } from 'knex';

/** Convert only object documents; malformed legacy data aborts the migration. */
export async function up(knex: Knex): Promise<void> {
    await knex.transaction(async transaction => {
        // Lock across validation and conversion so concurrent writers cannot
        // introduce an unchecked value. PostgreSQL rejects malformed JSON casts.
        await transaction.raw(
            'lock table transaction_scan_items in access exclusive mode'
        );
        const invalid = await transaction('transaction_scan_items')
            .whereRaw("jsonb_typeof(draft_json::jsonb) <> 'object'")
            .orWhereRaw(
                "corrected_json is not null and jsonb_typeof(corrected_json::jsonb) <> 'object'"
            )
            .first('id');
        if (invalid)
            throw new Error(
                'Scan item JSON migration requires object documents. Repair legacy data before retrying.'
            );
        await transaction.raw(`alter table transaction_scan_items
            alter column draft_json type jsonb using draft_json::jsonb,
            alter column corrected_json type jsonb using corrected_json::jsonb`);
    });
}

/** Stop consumers before rollback; semantic document data is preserved. */
export async function down(knex: Knex): Promise<void> {
    await knex.raw(`alter table transaction_scan_items
        alter column draft_json type text using draft_json::text,
        alter column corrected_json type text using corrected_json::text`);
}
