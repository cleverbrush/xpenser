import type { Category, Transaction } from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import { categoriesByRecentUse } from './capture-suggestions';

const timestamp = new Date('2026-05-01T00:00:00.000Z');

function category(
    id: number,
    name: string,
    type: Category['type'] = 'expense'
): Category {
    return {
        id,
        budgetId: 1,
        name,
        type,
        parentId: null,
        kind: 'normal',
        displayName: name,
        inUse: true,
        hasChildren: false,
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp
    };
}

function transaction(categoryId: number): Pick<Transaction, 'categoryId'> {
    return { categoryId };
}

describe('categoriesByRecentUse', () => {
    it('orders categories by recent transaction popularity', () => {
        const categories = [
            category(1, 'Rent'),
            category(2, 'Coffee'),
            category(3, 'Groceries'),
            category(4, 'Salary', 'income')
        ];

        const sorted = categoriesByRecentUse(categories, [
            transaction(3),
            transaction(2),
            transaction(2),
            transaction(4),
            transaction(3),
            transaction(3)
        ]);

        expect(sorted.map(item => item.name)).toEqual([
            'Groceries',
            'Coffee',
            'Salary',
            'Rent'
        ]);
    });

    it('keeps original ordering when categories have no usage', () => {
        const categories = [category(1, 'Rent'), category(2, 'Coffee')];

        expect(
            categoriesByRecentUse(categories, []).map(item => item.id)
        ).toEqual([1, 2]);
    });
});
