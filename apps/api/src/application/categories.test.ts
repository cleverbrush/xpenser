import { describe, expect, it } from 'vitest';
import {
    CategoryInUseError,
    CategoryNotFoundError,
    categoriesByRecentTransactionCount,
    LastCategoryError
} from './categories.js';

describe('category domain errors', () => {
    it('has explicit errors for delete preconditions', () => {
        expect(new CategoryInUseError('in use')).toBeInstanceOf(Error);
        expect(new CategoryNotFoundError('missing')).toBeInstanceOf(Error);
        expect(new LastCategoryError('required')).toBeInstanceOf(Error);
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
