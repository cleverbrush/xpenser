import type { InferType } from '@cleverbrush/schema';
import type {
    Category,
    CreateCategoryBody,
    UpdateCategoryBodySchema
} from '@xpenser/contracts';
import type { AppDb, CategoryDb } from '../db/schemas.js';

export class CategoryInUseError extends Error {}
export class CategoryNotFoundError extends Error {}

type UpdateCategoryBody = InferType<typeof UpdateCategoryBodySchema>;

function mapCategory(row: CategoryDb, inUse: boolean): Category {
    return {
        id: row.id,
        name: row.name,
        type: row.type,
        inUse,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

async function usedCategoryIds(
    db: AppDb,
    userId: number
): Promise<Set<number>> {
    const transactions = await db.transactions.where(
        transaction => transaction.userId,
        userId
    );

    return new Set(transactions.map(transaction => transaction.categoryId));
}

export async function listCategories(
    db: AppDb,
    userId: number
): Promise<Category[]> {
    const [categories, inUse] = await Promise.all([
        db.categories
            .where(category => category.userId, userId)
            .orderBy(category => category.type, 'asc')
            .orderBy(category => category.name, 'asc'),
        usedCategoryIds(db, userId)
    ]);

    return (categories as CategoryDb[]).map(category =>
        mapCategory(category, inUse.has(category.id))
    );
}

export async function createCategory(
    db: AppDb,
    userId: number,
    body: CreateCategoryBody
): Promise<Category> {
    const created = await db.categories.insert({
        userId,
        name: body.name.trim(),
        type: body.type
    });

    return mapCategory(created as CategoryDb, false);
}

export async function updateCategory(
    db: AppDb,
    userId: number,
    categoryId: number,
    body: UpdateCategoryBody
): Promise<Category> {
    const update: {
        name?: string;
        type?: 'expense' | 'income';
        updatedAt: Date;
    } = { updatedAt: new Date() };
    if (body.name !== undefined) {
        update.name = body.name.trim();
    }
    if (body.type !== undefined) {
        update.type = body.type;
    }

    const [updated] = await db.categories
        .where(category => category.id, categoryId)
        .where(category => category.userId, userId)
        .update(update)
        .then(rows => rows as CategoryDb[]);

    if (!updated) {
        throw new CategoryNotFoundError('Category was not found.');
    }

    const inUse = await usedCategoryIds(db, userId);
    return mapCategory(updated, inUse.has(updated.id));
}

export async function deleteCategory(
    db: AppDb,
    userId: number,
    categoryId: number
): Promise<void> {
    const category = await db.categories
        .where(candidate => candidate.id, categoryId)
        .where(candidate => candidate.userId, userId)
        .first();
    if (!category) {
        throw new CategoryNotFoundError('Category was not found.');
    }

    const usage = await db.transactions
        .where(transaction => transaction.categoryId, categoryId)
        .limit(1);
    if (usage.length > 0) {
        throw new CategoryInUseError(
            'Category cannot be deleted while transactions use it.'
        );
    }

    await db.categories
        .where(candidate => candidate.id, categoryId)
        .where(candidate => candidate.userId, userId)
        .delete();
}
