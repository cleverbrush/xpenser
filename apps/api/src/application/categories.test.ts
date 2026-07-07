import { describe, expect, it } from 'vitest';
import type { CategoryDb } from '../db/schemas.js';
import {
    CategoryHierarchyError,
    CategoryInUseError,
    CategoryNotFoundError,
    categoriesByRecentTransactionCount,
    categoryAvailableForTransactions,
    categoryReportingType,
    deleteCategory,
    LastCategoryError,
    moveAndDeleteCategory
} from './categories.js';

describe('category domain errors', () => {
    it('has explicit errors for delete preconditions', () => {
        expect(new CategoryInUseError('in use')).toBeInstanceOf(Error);
        expect(new CategoryNotFoundError('missing')).toBeInstanceOf(Error);
        expect(new LastCategoryError('required')).toBeInstanceOf(Error);
    });
});

describe('category reporting direction', () => {
    it('reports offset children on the opposite side', () => {
        expect(categoryReportingType({ kind: 'normal', type: 'expense' })).toBe(
            'expense'
        );
        expect(categoryReportingType({ kind: 'offset', type: 'expense' })).toBe(
            'income'
        );
        expect(categoryReportingType({ kind: 'offset', type: 'income' })).toBe(
            'expense'
        );
    });
});

describe('category transaction availability', () => {
    it('blocks archived categories and children of archived parents', () => {
        const archivedAt = new Date('2026-05-10T00:00:00.000Z');
        const car: CategoryDb = {
            id: 1,
            userId: 1,
            budgetId: 1,
            name: 'Car',
            type: 'expense',
            parentId: null,
            kind: 'normal',
            archivedAt,
            createdAt: archivedAt,
            updatedAt: archivedAt
        };
        const fuel: CategoryDb = {
            ...car,
            id: 2,
            name: 'Fuel',
            parentId: car.id,
            archivedAt: null
        };
        const groceries: CategoryDb = {
            ...car,
            id: 3,
            name: 'Groceries',
            archivedAt: null
        };
        const categoriesById = new Map([
            [car.id, car],
            [fuel.id, fuel],
            [groceries.id, groceries]
        ]);

        expect(categoryAvailableForTransactions(car, categoriesById)).toBe(
            false
        );
        expect(categoryAvailableForTransactions(fuel, categoriesById)).toBe(
            false
        );
        expect(
            categoryAvailableForTransactions(groceries, categoriesById)
        ).toBe(true);
    });
});

describe('category popularity ordering', () => {
    it('sorts categories by recent transaction count descending', () => {
        const categories = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
        const transactions = [
            { categoryId: 3 },
            { categoryId: 2 },
            { categoryId: 3 },
            { categoryId: 1 },
            { categoryId: 3 },
            { categoryId: 2 }
        ];

        expect(
            categoriesByRecentTransactionCount(categories, transactions).map(
                category => category.id
            )
        ).toEqual([3, 2, 1, 4]);
    });

    it('preserves original category order for equal popularity', () => {
        const categories = [{ id: 4 }, { id: 2 }, { id: 1 }, { id: 3 }];
        const transactions = [
            { categoryId: 1 },
            { categoryId: 4 },
            { categoryId: 2 }
        ];

        expect(
            categoriesByRecentTransactionCount(categories, transactions).map(
                category => category.id
            )
        ).toEqual([4, 2, 1, 3]);
    });
});

type TestTransaction = {
    id: number;
    userId: number;
    budgetId: number;
    categoryId: number;
    type: 'expense' | 'income';
    updatedAt: Date;
};

class TestQuery<T extends object> implements PromiseLike<T[]> {
    constructor(
        private readonly source: T[],
        private readonly rows: T[] = source
    ) {}

    where<TValue>(selector: (row: T) => TValue, value: TValue): TestQuery<T> {
        return new TestQuery(
            this.source,
            this.rows.filter(row => selector(row) === value)
        );
    }

    first(): Promise<T | undefined> {
        return Promise.resolve(this.rows[0]);
    }

    limit(count: number): Promise<T[]> {
        return Promise.resolve(this.rows.slice(0, count));
    }

    update(update: Partial<T>): Promise<T[]> {
        for (const row of this.rows) {
            Object.assign(row, update);
        }
        return Promise.resolve(this.rows);
    }

    delete(): Promise<void> {
        for (const row of this.rows) {
            const index = this.source.indexOf(row);
            if (index >= 0) {
                this.source.splice(index, 1);
            }
        }
        return Promise.resolve();
    }

    // biome-ignore lint/suspicious/noThenProperty: this test fake emulates the DB collection promise API.
    then<TResult1 = T[], TResult2 = never>(
        onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null
    ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve(this.rows).then(onfulfilled, onrejected);
    }
}

function categoryRow(
    id: number,
    name: string,
    overrides: Partial<CategoryDb> = {}
): CategoryDb {
    const timestamp = new Date('2026-05-10T12:30:00.000Z');
    return {
        id,
        userId: 1,
        budgetId: 1,
        name,
        type: 'expense',
        parentId: null,
        kind: 'normal',
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

type TestDb = {
    budgetMembers: {
        where(): { where(): { first(): Promise<object> } };
    };
    budgets: {
        find(id: number): Promise<object>;
    };
    categories: {
        where<TValue>(
            selector: (row: CategoryDb) => TValue,
            value: TValue
        ): TestQuery<CategoryDb>;
    };
    transactions: {
        where<TValue>(
            selector: (row: TestTransaction) => TValue,
            value: TValue
        ): TestQuery<TestTransaction>;
    };
    transaction<T>(callback: (trx: TestDb) => Promise<T>): Promise<T>;
};

function testDb(
    categories: CategoryDb[],
    transactions: TestTransaction[]
): TestDb {
    const budget = {
        id: 1,
        name: 'Main',
        defaultCurrency: 'USD',
        countryCode: 'US',
        createdByUserId: 1,
        createdAt: new Date('2026-05-10T12:30:00.000Z'),
        updatedAt: new Date('2026-05-10T12:30:00.000Z')
    };
    const member = {
        budgetId: 1,
        userId: 1,
        role: 'admin',
        canCreateTransactions: true,
        canUpdateTransactions: true,
        canDeleteTransactions: true,
        canManageCategories: true,
        canManageVendors: true,
        canManageTags: true,
        canManageMembers: true,
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt
    };
    return {
        budgets: {
            find: async () => budget
        },
        budgetMembers: {
            where: () => ({
                where: () => ({
                    first: async () => member
                })
            })
        },
        categories: {
            where<TValue>(
                selector: (row: CategoryDb) => TValue,
                value: TValue
            ) {
                return new TestQuery(categories).where(selector, value);
            }
        },
        transactions: {
            where<TValue>(
                selector: (row: TestTransaction) => TValue,
                value: TValue
            ) {
                return new TestQuery(transactions).where(selector, value);
            }
        },
        transaction: async <T>(
            callback: (trx: ReturnType<typeof testDb>) => Promise<T>
        ) => callback(testDb(categories, transactions))
    };
}

describe('delete category', () => {
    it('rejects archived categories', async () => {
        const archived = categoryRow(1, 'Old fuel', {
            archivedAt: new Date('2026-05-12T00:00:00.000Z')
        });
        const replacement = categoryRow(2, 'Fuel');

        await expect(
            deleteCategory(
                testDb([archived, replacement], []) as never,
                1,
                archived.id
            )
        ).rejects.toBeInstanceOf(CategoryHierarchyError);
    });
});

describe('move and delete category', () => {
    it('moves matching user transactions and deletes the source category', async () => {
        const source = categoryRow(1, 'Old fuel');
        const replacement = categoryRow(2, 'Fuel');
        const categories = [source, replacement];
        const transactions = [
            {
                id: 1,
                userId: 1,
                budgetId: 1,
                categoryId: source.id,
                type: 'income' as const,
                updatedAt: source.updatedAt
            },
            {
                id: 2,
                userId: 2,
                budgetId: 2,
                categoryId: source.id,
                type: 'expense' as const,
                updatedAt: source.updatedAt
            }
        ];

        await moveAndDeleteCategory(
            testDb(categories, transactions) as never,
            1,
            source.id,
            replacement.id
        );

        expect(categories.map(category => category.id)).toEqual([
            replacement.id
        ]);
        expect(transactions[0]).toMatchObject({
            categoryId: replacement.id,
            type: replacement.type
        });
        expect(transactions[1]).toMatchObject({
            categoryId: source.id,
            type: 'expense'
        });
    });

    it('moves offset transactions to a normal same-direction replacement', async () => {
        const source = categoryRow(1, 'Returns', { kind: 'offset' });
        const replacement = categoryRow(2, 'Salary', { type: 'income' });
        const categories = [source, replacement];
        const transactions = [
            {
                id: 1,
                userId: 1,
                budgetId: 1,
                categoryId: source.id,
                type: 'expense' as const,
                updatedAt: source.updatedAt
            }
        ];

        await moveAndDeleteCategory(
            testDb(categories, transactions) as never,
            1,
            source.id,
            replacement.id
        );

        expect(categories.map(category => category.id)).toEqual([
            replacement.id
        ]);
        expect(transactions[0]).toMatchObject({
            categoryId: replacement.id,
            type: 'income'
        });
    });

    it('rejects replacement categories with a different effective direction', async () => {
        const source = categoryRow(1, 'Old fuel');
        const replacement = categoryRow(2, 'Returns', { kind: 'offset' });

        await expect(
            moveAndDeleteCategory(
                testDb([source, replacement], []) as never,
                1,
                source.id,
                replacement.id
            )
        ).rejects.toBeInstanceOf(CategoryHierarchyError);
    });

    it('rejects archived replacement categories', async () => {
        const source = categoryRow(1, 'Old fuel');
        const replacement = categoryRow(2, 'Archived fuel', {
            archivedAt: new Date('2026-05-12T00:00:00.000Z')
        });

        await expect(
            moveAndDeleteCategory(
                testDb([source, replacement], []) as never,
                1,
                source.id,
                replacement.id
            )
        ).rejects.toBeInstanceOf(CategoryHierarchyError);
    });

    it('rejects deleting a parent category with children', async () => {
        const source = categoryRow(1, 'Car');
        const replacement = categoryRow(2, 'Auto');
        const child = categoryRow(3, 'Fuel', { parentId: source.id });

        await expect(
            moveAndDeleteCategory(
                testDb([source, replacement, child], []) as never,
                1,
                source.id,
                replacement.id
            )
        ).rejects.toBeInstanceOf(CategoryHierarchyError);
    });
});
