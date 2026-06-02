import type { Knex } from 'knex';

type CategoryRow = {
    readonly id: number;
    readonly user_id: number;
    readonly type: 'expense' | 'income';
};

function insertedId(row: { readonly id: number } | number): number {
    return typeof row === 'number' ? row : row.id;
}

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('categories', table => {
        table
            .integer('parent_id')
            .nullable()
            .references('id')
            .inTable('categories')
            .onDelete('RESTRICT');
        table.string('kind', 20).notNullable().defaultTo('normal');
        table.index(['parent_id'], 'idx_categories_parent_id');
        table.dropUnique(
            ['user_id', 'type', 'name'],
            'uq_categories_user_type_name'
        );
    });

    const reversalCategories = (await knex('categories as c')
        .select('c.id', 'c.user_id', 'c.type')
        .join('transactions as t', 't.category_id', 'c.id')
        .where('t.effect', 'reversal')
        .groupBy('c.id', 'c.user_id', 'c.type')) as CategoryRow[];

    for (const category of reversalCategories) {
        const [inserted] = await knex('categories')
            .insert({
                user_id: category.user_id,
                parent_id: category.id,
                name: category.type === 'expense' ? 'Returns' : 'Corrections',
                type: category.type,
                kind: 'offset'
            })
            .returning('id');
        const childId = insertedId(inserted);

        await knex('transactions')
            .where({ category_id: category.id, effect: 'reversal' })
            .update({ category_id: childId, effect: 'normal' });
    }

    await knex.raw(`
        create unique index uq_categories_user_type_top_name
        on categories (user_id, type, name)
        where parent_id is null
    `);
    await knex.raw(`
        create unique index uq_categories_user_type_parent_name
        on categories (user_id, type, parent_id, name)
        where parent_id is not null
    `);

    await knex.schema.alterTable('transactions', table => {
        table.dropColumn('effect');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('transactions', table => {
        table.string('effect', 20).notNullable().defaultTo('normal');
    });

    await knex.raw(`
        update transactions t
        set category_id = c.parent_id,
            effect = 'reversal'
        from categories c
        where t.category_id = c.id
          and c.kind = 'offset'
          and c.parent_id is not null
    `);

    await knex.raw(`
        delete from categories
        where kind = 'offset'
          and parent_id is not null
    `);

    await knex.raw(`
        update categories c
        set name = left(p.name || ' -> ' || c.name, 120),
            parent_id = null
        from categories p
        where c.parent_id = p.id
    `);

    await knex.raw('drop index if exists uq_categories_user_type_parent_name');
    await knex.raw('drop index if exists uq_categories_user_type_top_name');

    await knex.schema.alterTable('categories', table => {
        table.dropIndex(['parent_id'], 'idx_categories_parent_id');
        table.dropColumn('parent_id');
        table.dropColumn('kind');
        table.unique(['user_id', 'type', 'name'], {
            indexName: 'uq_categories_user_type_name'
        });
    });
}
