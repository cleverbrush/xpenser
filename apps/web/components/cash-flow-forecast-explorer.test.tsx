/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { CashFlowForecastResponse } from '@xpenser/contracts';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CashFlowForecastExplorer } from './cash-flow-forecast-explorer';

const mocks = vi.hoisted(() => ({
    createXpenserClient: vi.fn(),
    refresh: vi.fn()
}));

vi.mock('@xpenser/client', () => ({
    createXpenserClient: mocks.createXpenserClient
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: mocks.refresh })
}));

vi.mock('recharts', () => ({
    Bar: () => null,
    BarChart: ({ children }: { readonly children: ReactNode }) => (
        <div data-testid="bar-chart">{children}</div>
    ),
    CartesianGrid: () => null,
    ReferenceLine: () => null,
    ResponsiveContainer: ({ children }: { readonly children: ReactNode }) => (
        <div>{children}</div>
    ),
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null
}));

function forecast(
    overrides: Partial<CashFlowForecastResponse> = {}
): CashFlowForecastResponse {
    return {
        anchorDate: new Date('2026-06-16T00:00:00.000Z'),
        currency: 'USD',
        generatedAt: new Date('2026-06-16T08:00:00.000Z'),
        historyDays: 180,
        historyFrom: new Date('2025-12-18T00:00:00.000Z'),
        historyTo: new Date('2026-06-15T23:59:59.999Z'),
        insightsStatus: 'unavailable',
        recurringPatterns: [
            {
                id: 'income:category:1:vendor:1',
                amount: 3000,
                averageIntervalDays: 30.3,
                cadence: 'monthly',
                categoryDisplayName: 'Salary',
                categoryId: 1,
                confidence: 'high',
                nextOccurrenceAt: new Date('2026-07-01T12:00:00.000Z'),
                occurrenceCount: 4,
                projectedCount: 3,
                projectedTotal: 9000,
                type: 'income',
                vendorId: 1,
                vendorName: 'Acme Payroll'
            }
        ],
        transactionCount: 12,
        windows: [
            {
                horizonDays: 30,
                averageDailyNet: 96.67,
                baselineExpenseTotal: 0,
                baselineIncomeTotal: 0,
                buckets: [],
                confidence: 'medium',
                expenseTotal: 100,
                from: new Date('2026-06-16T00:00:00.000Z'),
                incomeTotal: 3000,
                netTotal: 2900,
                projectedRecurringCount: 5,
                recurringExpenseTotal: 100,
                recurringIncomeTotal: 3000,
                to: new Date('2026-07-15T23:59:59.999Z')
            },
            {
                horizonDays: 90,
                averageDailyNet: 97.11,
                baselineExpenseTotal: 0,
                baselineIncomeTotal: 0,
                buckets: [],
                confidence: 'medium',
                expenseTotal: 260,
                from: new Date('2026-06-16T00:00:00.000Z'),
                incomeTotal: 9000,
                netTotal: 8740,
                projectedRecurringCount: 16,
                recurringExpenseTotal: 260,
                recurringIncomeTotal: 9000,
                to: new Date('2026-09-13T23:59:59.999Z')
            }
        ],
        ...overrides
    };
}

describe('CashFlowForecastExplorer', () => {
    it('renders the 30 day forecast and switches to 90 days', () => {
        render(
            <CashFlowForecastExplorer forecast={forecast()} timezone="UTC" />
        );

        expect(
            screen.getByRole('heading', { name: 'Cash-flow forecast' })
        ).toBeTruthy();
        expect(screen.getByText('$2,900.00')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Regenerate' })).toBeTruthy();
        expect(screen.getByText(/Generated/)).toBeTruthy();
        expect(screen.getByText('AI insight unavailable')).toBeTruthy();
        expect(screen.getByText('Acme Payroll')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: /90 days/ }));

        expect(screen.getByText('$8,740.00')).toBeTruthy();
        expect(
            screen.getByText('16 projected recurring occurrences')
        ).toBeTruthy();
    });

    it('renders available AI insight sections', () => {
        render(
            <CashFlowForecastExplorer
                forecast={forecast({
                    insightsStatus: 'available',
                    insights: {
                        headline: 'Positive cash flow expected',
                        summary: 'Recurring income covers projected expenses.',
                        risks: ['A subscription remains active.'],
                        opportunities: ['Net cash flow stays positive.'],
                        recurringNotes: ['Salary cadence is monthly.'],
                        actions: ['Review recurring subscriptions.']
                    }
                })}
                timezone="UTC"
            />
        );

        expect(screen.getByText('Positive cash flow expected')).toBeTruthy();
        expect(screen.getByText('A subscription remains active.')).toBeTruthy();
        expect(
            screen.getByText('Review recurring subscriptions.')
        ).toBeTruthy();
    });

    it('renders pending AI insight progress', () => {
        render(
            <CashFlowForecastExplorer
                forecast={forecast({ insightsStatus: 'pending' })}
                timezone="UTC"
            />
        );

        expect(screen.getByText('AI insight generating')).toBeTruthy();
        expect(screen.getByRole('status')).toBeTruthy();
        expect(screen.getByText('20%')).toBeTruthy();
    });
});
