import type { Knex } from 'knex';

async function addCheckConstraintIfMissing(
    knex: Knex,
    tableName: string,
    constraintName: string,
    expression: string
) {
    const result = await knex.raw(
        `
        select 1
        from pg_constraint
        where conname = ?
          and conrelid = ?::regclass
        `,
        [constraintName, tableName]
    );
    if (result.rows.length > 0) {
        return;
    }

    await knex.raw(`alter table ?? add constraint ?? check (${expression})`, [
        tableName,
        constraintName
    ]);
}

async function dropConstraintIfExists(
    knex: Knex,
    tableName: string,
    constraintName: string
) {
    await knex.raw(`alter table ?? drop constraint if exists ??`, [
        tableName,
        constraintName
    ]);
}

export async function up(knex: Knex): Promise<void> {
    if (await knex.schema.hasColumn('transactions', 'note')) {
        await knex.raw('alter table transactions alter column note type text');
        await addCheckConstraintIfMissing(
            knex,
            'transactions',
            'chk_transactions_note_length',
            'char_length(note) <= 500'
        );
    }

    if (await knex.schema.hasTable('vendors')) {
        await knex.raw(
            'alter table vendors alter column description type text'
        );
        await knex.raw(`
            update vendors
            set primary_color = null
            where primary_color is not null
              and primary_color !~ '^#[0-9A-Fa-f]{6}$'
        `);
        await knex.raw(`
            alter table vendors
            alter column primary_color type varchar(7)
            using case
                when primary_color ~ '^#[0-9A-Fa-f]{6}$'
                    then lower(primary_color)::varchar(7)
                else null
            end
        `);
        await addCheckConstraintIfMissing(
            knex,
            'vendors',
            'chk_vendors_description_length',
            'char_length(description) <= 1000'
        );
        await addCheckConstraintIfMissing(
            knex,
            'vendors',
            'chk_vendors_primary_color_format',
            "primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'"
        );
    }
}

export async function down(knex: Knex): Promise<void> {
    if (await knex.schema.hasTable('vendors')) {
        await dropConstraintIfExists(
            knex,
            'vendors',
            'chk_vendors_primary_color_format'
        );
        await dropConstraintIfExists(
            knex,
            'vendors',
            'chk_vendors_description_length'
        );
        await knex.raw(`
            alter table vendors
            alter column primary_color type varchar(16)
        `);
        await knex.raw(`
            alter table vendors
            alter column description type varchar(1000)
            using left(description, 1000)::varchar(1000)
        `);
    }

    if (await knex.schema.hasColumn('transactions', 'note')) {
        await dropConstraintIfExists(
            knex,
            'transactions',
            'chk_transactions_note_length'
        );
        await knex.raw(`
            alter table transactions
            alter column note type varchar(500)
            using left(note, 500)::varchar(500)
        `);
    }
}
