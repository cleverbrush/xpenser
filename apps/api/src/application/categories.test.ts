import { describe, expect, it } from 'vitest';
import type { CategoryDb } from '../db/schemas.js';
import {
    CategoryInUseError,
    CategoryNotFoundError,
    categoriesByRecentTransactionCount,
    categoryAvailableForTransactions,
    categoryReportingType,
    LastCategoryError
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
