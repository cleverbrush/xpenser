/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import type { StatsOverview } from '@xpenser/contracts';
import { describe, expect, it, vi } from 'vitest';
import { StatsCards } from './stats-explorer';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn() })
}));

function stats(overrides: Partial<StatsOverview> = {}): StatsOverview {
    return {
        averageExpense: 400,
        averageIncome: 900,
        byCategory: [],
        byParentCategory: [],
        comparison: {
            previousPeriod: {
                expenseCount: 1,
                expenseTotal: 500,
                from: new Date('2026-04-01T00:00:00.000Z'),
                incomeCount: 1,
                incomeTotal: 600,
                netTotal: 100,
                to: new Date('2026-04-30T23:59:59.999Z'),
                transactionCount: 2
            },
            previousYear: {
                expenseCount: 1,
                expenseTotal: 300,
                from: new Date('2025-05-01T00:00:00.000Z'),
                incomeCount: 1,
                incomeTotal: 750,
                netTotal: 450,
                to: new Date('2025-05-31T23:59:59.999Z'),
                transactionCount: 2
            }
        },
        currency: 'USD',
        expenseCount: 1,
        expenseTotal: 400,
        from: new Date('2026-05-01T00:00:00.000Z'),
        groupBy: 'day',
        incomeCount: 1,
        incomeTotal: 900,
        largestExpenseCategory: 'Groceries',
        largestIncomeCategory: 'Salary',
        netTotal: 500,
        savingsRate: 55.55555555555556,
        timeframe: 'custom',
        to: new Date('2026-05-31T23:59:59.999Z'),
        transactionCount: 2,
        trend: [],
        ...overrides
    };
}

describe('StatsCards', () => {
    it('adds previous-period percentages to money cards', () => {
        render(<StatsCards stats={stats()} />);

        expect(screen.getByText('(+50%)')).toBeTruthy();
        expect(screen.getByText('(-20%)')).toBeTruthy();
        expect(screen.getByText('(+400%)')).toBeTruthy();
        expect(screen.getByText('(-20%)').className).toContain('emerald');
        expect(screen.getAllByText(/^\([+-]?\d+(?:\.\d)?%\)$/)).toHaveLength(3);
    });
});
