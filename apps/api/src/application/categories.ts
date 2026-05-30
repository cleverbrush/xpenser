import type { InferType } from '@cleverbrush/schema';
import type {
    Category,
    CategoryListQuery,
    CreateCategoryBody,
    UpdateCategoryBodySchema
} from '@xpenser/contracts';
import type { AppDb, CategoryDb, TransactionDb } from '../db/schemas.js';

export class CategoryInUseError extends Error {}
export class CategoryNotFoundError extends Error {}
export class LastCategoryError extends Error {}

type UpdateCategoryBody = InferType<typeof UpdateCategoryBodySchema>;
type CategoryUsageTransaction = Pick<TransactionDb, 'categoryId'>;

const recentCategoryWindowMs = 30 * 24 * 60 * 60 * 1000;

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

async function recentCategoryTransactions(
    db: AppDb,
    userId: number
): Promise<TransactionDb[]> {
    const now = new Date();
    const from = new Date(now.getTime() - recentCategoryWindowMs);

    return (await db.transactions
        .where(transaction => transaction.userId, userId)
        .where(transaction => transaction.occurredAt, '>=', from)
        .where(
            transaction => transaction.occurredAt,
            '<=',
            now
        )) as TransactionDb[];
}

export function categoriesByRecentTransactionCount<T extends { id: number }>(
    categories: readonly T[],
    transactions: readonly CategoryUsageTransaction[]
): T[] {
    const originalIndex = new Map(
        categories.map((category, index) => [category.id, index] as const)
    );
    const counts = new Map<number, number>();

    for (const transaction of transactions) {
        counts.set(
            transaction.categoryId,
            (counts.get(transaction.categoryId) ?? 0) + 1
        );
    }

    return [...categories].sort((left, right) => {
        const countDelta =
            (counts.get(right.id) ?? 0) - (counts.get(left.id) ?? 0);

        if (countDelta !== 0) {
            return countDelta;
        }

        return (
            (originalIndex.get(left.id) ?? 0) -
            (originalIndex.get(right.id) ?? 0)
        );
    });
}

export async function listCategories(
    db: AppDb,
    userId: number,
    query: CategoryListQuery = {}
): Promise<Category[]> {
    const [categories, inUse, recentTransactions] = await Promise.all([
        db.categories
            .where(category => category.userId, userId)
            .orderBy(category => category.type, 'asc')
            .orderBy(category => category.name, 'asc'),
        usedCategoryIds(db, userId),
        query.sort === 'recent-transaction-count'
            ? recentCategoryTransactions(db, userId)
            : Promise.resolve([])
    ]);
    const orderedCategories =
        query.sort === 'recent-transaction-count'
            ? categoriesByRecentTransactionCount(
                  categories as CategoryDb[],
                  recentTransactions
              )
            : (categories as CategoryDb[]);

    return orderedCategories.map(category =>
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

    const categories = await db.categories.where(
        candidate => candidate.userId,
        userId
    );
    if (categories.length <= 1) {
        throw new LastCategoryError('At least one category is required.');
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
