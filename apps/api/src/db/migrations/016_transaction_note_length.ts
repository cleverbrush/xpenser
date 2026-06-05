import type { Knex } from 'knex';

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

async function addCheckConstraint(
    knex: Knex,
    tableName: string,
    constraintName: string,
    expression: string
) {
    await knex.raw(`alter table ?? add constraint ?? check (${expression})`, [
        tableName,
        constraintName
    ]);
}

export async function up(knex: Knex): Promise<void> {
    if (!(await knex.schema.hasColumn('transactions', 'note'))) {
        return;
    }

    await dropConstraintIfExists(
        knex,
        'transactions',
        'chk_transactions_note_length'
    );
    await addCheckConstraint(
        knex,
        'transactions',
        'chk_transactions_note_length',
        'char_length(note) <= 2000'
    );
}

export async function down(knex: Knex): Promise<void> {
    if (!(await knex.schema.hasColumn('transactions', 'note'))) {
        return;
    }

    await knex.raw(`
        update transactions
        set note = left(note, 500)
        where note is not null
          and char_length(note) > 500
    `);
    await dropConstraintIfExists(
        knex,
        'transactions',
        'chk_transactions_note_length'
    );
    await addCheckConstraint(
        knex,
        'transactions',
        'chk_transactions_note_length',
        'char_length(note) <= 500'
    );
}
