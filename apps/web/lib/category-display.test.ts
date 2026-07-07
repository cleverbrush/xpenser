import type { Category } from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import {
    categoryAvailableForTransactions,
    categoryEffectiveType,
    categoryTree,
    transactionCategoryOptions
} from './category-display';

const timestamp = new Date('2026-05-01T00:00:00.000Z');

function category(
    id: number,
    name: string,
    overrides: Partial<Category> = {}
): Category {
    return {
        id,
        budgetId: 1,
        name,
        type: 'expense',
        parentId: null,
        kind: 'normal',
        displayName: name,
        inUse: false,
        hasChildren: false,
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

describe('category display helpers', () => {
    it('uses offset kind as the opposite displayed direction', () => {
        expect(
            categoryEffectiveType(
                category(1, 'Salary', { type: 'income', kind: 'offset' })
            )
        ).toBe('expense');
        expect(
            categoryEffectiveType(
                category(2, 'Groceries', {
                    type: 'expense',
                    kind: 'offset'
                })
            )
        ).toBe('income');
        expect(
            categoryEffectiveType(category(3, 'Rent', { type: 'expense' }))
        ).toBe('expense');
    });

    it('groups child categories under their parent in original order', () => {
        const categories = [
            category(1, 'Car', { hasChildren: true }),
            category(2, 'Fuel', { parentId: 1, displayName: 'Car -> Fuel' }),
            category(3, 'Parking', {
                parentId: 1,
                displayName: 'Car -> Parking'
            }),
            category(4, 'Salary', { type: 'income' })
        ];

        expect(
            categoryTree(categories).map(node => ({
                category: node.category.name,
                children: node.children.map(child => child.name)
            }))
        ).toEqual([
            { category: 'Car', children: ['Fuel', 'Parking'] },
            { category: 'Salary', children: [] }
        ]);
    });

    it('hides archived categories and children of archived parents from transaction options', () => {
        const archivedAt = new Date('2026-05-10T00:00:00.000Z');
        const car = category(1, 'Car', { archivedAt, hasChildren: true });
        const fuel = category(2, 'Fuel', {
            displayName: 'Car -> Fuel',
            parentId: 1
        });
        const categories = [
            car,
            fuel,
            category(3, 'Groceries'),
            category(4, 'Old income', {
                archivedAt,
                type: 'income'
            })
        ];

        expect(categoryAvailableForTransactions(car, categories)).toBe(false);
        expect(categoryAvailableForTransactions(fuel, categories)).toBe(false);
        expect(
            transactionCategoryOptions(categories).map(item => item.name)
        ).toEqual(['Groceries']);
    });

    it('keeps an explicitly included archived category available for editing', () => {
        const archivedAt = new Date('2026-05-10T00:00:00.000Z');
        const categories = [
            category(1, 'Old rent', { archivedAt }),
            category(2, 'Groceries')
        ];

        expect(
            transactionCategoryOptions(categories, 1).map(item => item.name)
        ).toEqual(['Old rent', 'Groceries']);
    });
});
