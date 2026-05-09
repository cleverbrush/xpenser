import type { InferType } from '@cleverbrush/schema';
import type {
    Category,
    CreateCategoryBody,
    UpdateCategoryBodySchema
} from '@xpenser/contracts';
import type { Knex } from 'knex';
import type { CategoryRow } from '../db/schemas.js';

export class CategoryInUseError extends Error {}
export class CategoryNotFoundError extends Error {}

type CategoryWithUsage = CategoryRow & {
    readonly transaction_count: string | number;
};

type UpdateCategoryBody = InferType<typeof UpdateCategoryBodySchema>;

function mapCategory(row: CategoryWithUsage): Category {
    return {
        id: row.id,
        name: row.name,
        type: row.type,
        inUse: Number(row.transaction_count) > 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function categorySelection(knex: Knex) {
    return knex('categories')
        .leftJoin('transactions', 'transactions.category_id', 'categories.id')
        .select(
            'categories.id',
            'categories.user_id',
            'categories.name',
            'categories.type',
            'categories.created_at',
            'categories.updated_at'
        )
        .count({ transaction_count: 'transactions.id' })
        .groupBy('categories.id');
}

export async function listCategories(
    knex: Knex,
    userId: number
): Promise<Category[]> {
    const rows = await categorySelection(knex)
        .where('categories.user_id', userId)
        .orderBy('categories.type', 'asc')
        .orderBy('categories.name', 'asc');

    return (rows as CategoryWithUsage[]).map(mapCategory);
}

export async function createCategory(
    knex: Knex,
    userId: number,
    body: CreateCategoryBody
): Promise<Category> {
    const [created] = await knex<CategoryRow>('categories')
        .insert({
            user_id: userId,
            name: body.name.trim(),
            type: body.type
        })
        .returning('*');

    if (!created) {
        throw new Error('Category insert did not return a row.');
    }

    return {
        id: created.id,
        name: created.name,
        type: created.type,
        inUse: false,
        createdAt: created.created_at,
        updatedAt: created.updated_at
    };
}

export async function updateCategory(
    knex: Knex,
    userId: number,
    categoryId: number,
    body: UpdateCategoryBody
): Promise<Category> {
    const update: Record<string, unknown> = { updated_at: knex.fn.now() };
    if (body.name !== undefined) {
        update.name = body.name.trim();
    }
    if (body.type !== undefined) {
        update.type = body.type;
    }

    const [updated] = await knex<CategoryRow>('categories')
        .where({ id: categoryId, user_id: userId })
        .update(update)
        .returning('*');

    if (!updated) {
        throw new CategoryNotFoundError('Category was not found.');
    }

    const [result] = await categorySelection(knex).where(
        'categories.id',
        updated.id
    );
    return mapCategory(result as CategoryWithUsage);
}

export async function deleteCategory(
    knex: Knex,
    userId: number,
    categoryId: number
): Promise<void> {
    const category = await knex<CategoryRow>('categories')
        .where({ id: categoryId, user_id: userId })
        .first();
    if (!category) {
        throw new CategoryNotFoundError('Category was not found.');
    }

    const usage = await knex('transactions')
        .count<{ count: string | number }[]>({ count: '*' })
        .where({ category_id: categoryId })
        .first();
    if (Number(usage?.count ?? 0) > 0) {
        throw new CategoryInUseError(
            'Category cannot be deleted while transactions use it.'
        );
    }

    await knex('categories')
        .where({ id: categoryId, user_id: userId })
        .delete();
}
