import type { Category } from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import { categoryEffectiveType, categoryTree } from './category-display';

const timestamp = new Date('2026-05-01T00:00:00.000Z');

function category(
    id: number,
    name: string,
    overrides: Partial<Category> = {}
): Category {
    return {
        id,
        name,
        type: 'expense',
        parentId: null,
        kind: 'normal',
        displayName: name,
        inUse: false,
        hasChildren: false,
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
});
