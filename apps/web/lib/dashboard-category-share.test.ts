import type { DashboardSummary } from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import { dashboardCategoryShare } from './dashboard-category-share';

type DashboardCategory = DashboardSummary['byCategory'][number];

const baseSummary: DashboardSummary = {
    byCategory: [],
    byParentCategory: [],
    currency: 'USD',
    expenseTotal: 400,
    from: new Date('2026-05-01T00:00:00.000Z'),
    incomeTotal: 800,
    comparison: {
        previousPeriod: {
            from: new Date('2026-04-01T00:00:00.000Z'),
            to: new Date('2026-04-30T23:59:59.999Z'),
            expenseTotal: 300,
            incomeTotal: 600,
            netTotal: 300
        }
    },
    vendorCount: 0,
    period: 'month',
    topVendors: [],
    to: new Date('2026-05-31T23:59:59.999Z')
};

function category(
    overrides: Partial<DashboardCategory> = {}
): DashboardCategory {
    return {
        categoryId: 1,
        categoryName: 'Category',
        categoryDisplayName: 'Category',
        categoryParentId: null,
        categoryKind: 'normal',
        percentChange: 0,
        previousPeriodTotal: 0,
        total: 0,
        transactionCount: 0,
        trend: [],
        type: 'expense',
        ...overrides
    };
}

describe('dashboard category share', () => {
    it('uses the income total as the basis for income categories', () => {
        expect(
            dashboardCategoryShare(
                baseSummary,
                category({ total: 200, type: 'income' })
            )
        ).toBe(25);
    });

    it('uses the expense total as the basis for expense categories', () => {
        expect(
            dashboardCategoryShare(baseSummary, category({ total: 100 }))
        ).toBe(25);
    });

    it('returns zero when the matching side has no activity', () => {
        expect(
            dashboardCategoryShare(
                { ...baseSummary, expenseTotal: 0 },
                category({ total: 100 })
            )
        ).toBe(0);
    });

    it('uses magnitude for display-only share calculations', () => {
        expect(
            dashboardCategoryShare(
                { ...baseSummary, incomeTotal: -100 },
                category({ total: -100, type: 'income' })
            )
        ).toBe(100);
    });

    it('bounds display shares to the pie chart percentage range', () => {
        expect(
            dashboardCategoryShare(baseSummary, category({ total: -100 }))
        ).toBe(25);
        expect(
            dashboardCategoryShare(baseSummary, category({ total: 500 }))
        ).toBe(100);
    });
});
