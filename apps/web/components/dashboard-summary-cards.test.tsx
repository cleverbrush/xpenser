/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import type { DashboardSummary } from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import { DashboardSummaryCards } from './dashboard-summary-cards';

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
    return {
        byCategory: [],
        byParentCategory: [],
        comparison: {
            previousPeriod: {
                from: new Date('2026-04-01T00:00:00.000Z'),
                to: new Date('2026-04-30T23:59:59.999Z'),
                expenseTotal: 500,
                incomeTotal: 600,
                netTotal: 100
            }
        },
        currency: 'USD',
        expenseTotal: 400,
        from: new Date('2026-05-01T00:00:00.000Z'),
        incomeTotal: 900,
        period: 'month',
        to: new Date('2026-05-31T23:59:59.999Z'),
        topVendors: [],
        vendorCount: 0,
        ...overrides
    };
}

describe('DashboardSummaryCards', () => {
    it('renders previous-period percentages for income, expenses, and net', () => {
        render(<DashboardSummaryCards summary={summary()} timezone="UTC" />);

        expect(screen.getByText('+50%')).toBeTruthy();
        expect(screen.getByText('-20%')).toBeTruthy();
        expect(screen.getByText('+400%')).toBeTruthy();
        expect(screen.getByText('+50%').className).toContain('emerald');
        expect(screen.getByText('-20%').className).toContain('emerald');
        expect(screen.getByText('+400%').className).toContain('emerald');
    });
});
