import { describe, expect, it } from 'vitest';
import { buildReportCategoryNodes } from './report-category-tree';

type TestCategory = {
    readonly categoryId: number;
    readonly categoryName: string;
    readonly categoryDisplayName: string;
    readonly categoryParentId: number | null;
    readonly categoryParentName?: string;
    readonly categoryKind: 'normal' | 'offset';
    readonly type: 'expense' | 'income';
    readonly total: number;
    readonly transactionCount: number;
};

function category(
    overrides: Partial<TestCategory> &
        Pick<TestCategory, 'categoryId' | 'categoryName'>
): TestCategory {
    return {
        categoryDisplayName: overrides.categoryName,
        categoryKind: 'normal',
        categoryParentId: null,
        total: 0,
        transactionCount: 0,
        type: 'expense',
        ...overrides
    };
}

function parentCategory(
    parentId: number,
    categories: readonly TestCategory[],
    type: TestCategory['type'],
    parentName: string
): TestCategory {
    return category({
        categoryDisplayName: parentName,
        categoryId: parentId,
        categoryName: parentName,
        total: categories.reduce((sum, item) => sum + item.total, 0),
        transactionCount: categories.reduce(
            (sum, item) => sum + item.transactionCount,
            0
        ),
        type
    });
}

function build(
    categories: readonly TestCategory[],
    parentCategories: readonly TestCategory[],
    type: TestCategory['type']
) {
    return buildReportCategoryNodes({
        categories,
        createParentCategory: parentCategory,
        parentCategories,
        type
    }).map(node => ({
        category: node.category.categoryName,
        children: node.children.map(child => child.categoryName),
        total: node.category.total,
        type: node.category.type
    }));
}

describe('report category tree', () => {
    it('groups return children under their parent in the income section', () => {
        const returns = category({
            categoryDisplayName: 'Car -> Returns',
            categoryId: 2,
            categoryKind: 'offset',
            categoryName: 'Returns',
            categoryParentId: 1,
            categoryParentName: 'Car',
            total: 25,
            transactionCount: 1,
            type: 'income'
        });

        expect(build([returns], [], 'income')).toEqual([
            {
                category: 'Car',
                children: ['Returns'],
                total: 25,
                type: 'income'
            }
        ]);
    });

    it('keeps duplicate return names separated by parent', () => {
        const carReturns = category({
            categoryDisplayName: 'Car -> Returns',
            categoryId: 2,
            categoryKind: 'offset',
            categoryName: 'Returns',
            categoryParentId: 1,
            categoryParentName: 'Car',
            total: 25,
            transactionCount: 1,
            type: 'income'
        });
        const travelReturns = category({
            categoryDisplayName: 'Travel -> Returns',
            categoryId: 4,
            categoryKind: 'offset',
            categoryName: 'Returns',
            categoryParentId: 3,
            categoryParentName: 'Travel',
            total: 10,
            transactionCount: 1,
            type: 'income'
        });

        expect(build([carReturns, travelReturns], [], 'income')).toEqual([
            {
                category: 'Car',
                children: ['Returns'],
                total: 25,
                type: 'income'
            },
            {
                category: 'Travel',
                children: ['Returns'],
                total: 10,
                type: 'income'
            }
        ]);
    });

    it('uses parent rollup subtotals when present', () => {
        const returns = category({
            categoryDisplayName: 'Car -> Returns',
            categoryId: 2,
            categoryKind: 'offset',
            categoryName: 'Returns',
            categoryParentId: 1,
            categoryParentName: 'Car',
            total: 25,
            transactionCount: 1,
            type: 'income'
        });
        const carRollup = category({
            categoryId: 1,
            categoryName: 'Car',
            total: 30,
            transactionCount: 2,
            type: 'income'
        });

        expect(build([returns], [carRollup], 'income')).toEqual([
            {
                category: 'Car',
                children: ['Returns'],
                total: 30,
                type: 'income'
            }
        ]);
    });

    it('uses parent rollup names when child metadata lacks a parent display path', () => {
        const returns = category({
            categoryDisplayName: 'Returns',
            categoryId: 2,
            categoryKind: 'offset',
            categoryName: 'Returns',
            categoryParentId: 1,
            total: 25,
            transactionCount: 1,
            type: 'income'
        });
        const carRollup = category({
            categoryId: 1,
            categoryName: 'Car',
            total: 25,
            transactionCount: 1,
            type: 'income'
        });

        expect(build([returns], [carRollup], 'income')).toEqual([
            {
                category: 'Car',
                children: ['Returns'],
                total: 25,
                type: 'income'
            }
        ]);
    });

    it('ignores rollup rows that point at child category ids', () => {
        const returns = category({
            categoryDisplayName: 'Car -> Returns',
            categoryId: 2,
            categoryKind: 'offset',
            categoryName: 'Returns',
            categoryParentId: 1,
            categoryParentName: 'Car',
            total: 25,
            transactionCount: 1,
            type: 'income'
        });
        const badRollup = category({
            categoryId: 2,
            categoryName: 'Returns',
            total: 25,
            transactionCount: 1,
            type: 'income'
        });

        expect(build([returns], [badRollup], 'income')).toEqual([
            {
                category: 'Car',
                children: ['Returns'],
                total: 25,
                type: 'income'
            }
        ]);
    });

    it('allows the same parent to appear in separate sections', () => {
        const fuel = category({
            categoryDisplayName: 'Car -> Fuel',
            categoryId: 2,
            categoryName: 'Fuel',
            categoryParentId: 1,
            categoryParentName: 'Car',
            total: 100,
            transactionCount: 1,
            type: 'expense'
        });
        const returns = category({
            categoryDisplayName: 'Car -> Returns',
            categoryId: 3,
            categoryKind: 'offset',
            categoryName: 'Returns',
            categoryParentId: 1,
            categoryParentName: 'Car',
            total: 25,
            transactionCount: 1,
            type: 'income'
        });

        expect(build([fuel, returns], [], 'expense')).toEqual([
            {
                category: 'Car',
                children: ['Fuel'],
                total: 100,
                type: 'expense'
            }
        ]);
        expect(build([fuel, returns], [], 'income')).toEqual([
            {
                category: 'Car',
                children: ['Returns'],
                total: 25,
                type: 'income'
            }
        ]);
    });
});
