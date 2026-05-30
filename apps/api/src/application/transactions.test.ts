import { describe, expect, it } from 'vitest';
import {
    categoryTrendMaxBuckets,
    compareTransactionsByOccurrenceAsc,
    compareTransactionsByOccurrenceDesc,
    dashboardStatsGroupBy,
    percentChange,
    resolveCategoryTrendRange,
    resolveDashboardComparisonRange,
    resolveDashboardPeriodWindow,
    resolveDashboardRange,
    resolveStatsRanges,
    summarizeCategoryTrendRows,
    TransactionCategoryError,
    TransactionNotFoundError,
    transactionSignedDefaultAmount
} from './transactions.js';

describe('transaction domain errors', () => {
    it('has explicit errors for not-found and invalid category cases', () => {
        expect(new TransactionNotFoundError('missing')).toBeInstanceOf(Error);
        expect(new TransactionCategoryError('bad category')).toBeInstanceOf(
            Error
        );
    });
});

describe('transaction sorting', () => {
    it('sorts latest transactions by occurrence date-time descending', () => {
        const rows = [
            { id: 1, occurredAt: new Date('2026-05-10T09:00:00.000Z') },
            { id: 2, occurredAt: new Date('2026-05-10T12:00:00.000Z') },
            { id: 3, occurredAt: new Date('2026-05-09T23:00:00.000Z') },
            { id: 4, occurredAt: new Date('2026-05-10T12:00:00.000Z') }
        ];

        expect(
            rows.sort(compareTransactionsByOccurrenceDesc).map(row => row.id)
        ).toEqual([4, 2, 1, 3]);
    });

    it('sorts oldest transactions by occurrence date-time ascending', () => {
        const rows = [
            { id: 1, occurredAt: new Date('2026-05-10T09:00:00.000Z') },
            { id: 2, occurredAt: new Date('2026-05-10T12:00:00.000Z') },
            { id: 3, occurredAt: new Date('2026-05-09T23:00:00.000Z') },
            { id: 4, occurredAt: new Date('2026-05-10T12:00:00.000Z') }
        ];

        expect(
            rows.sort(compareTransactionsByOccurrenceAsc).map(row => row.id)
        ).toEqual([3, 1, 2, 4]);
    });
});

describe('transaction effects', () => {
    it('keeps normal transactions positive for category totals', () => {
        expect(
            transactionSignedDefaultAmount({
                defaultCurrencyAmount: '12.34',
                effect: 'normal'
            })
        ).toBe(12.34);
    });

    it('subtracts reversal transactions from category totals', () => {
        expect(
            transactionSignedDefaultAmount({
                defaultCurrencyAmount: '12.34',
                effect: 'reversal'
            })
        ).toBe(-12.34);
    });
});

describe('stats range resolution', () => {
    it('compares an in-progress month with the same elapsed previous month', () => {
        const now = new Date(2026, 4, 10, 12, 34, 0, 0);
        const ranges = resolveStatsRanges(
            { timeframe: 'this-month', groupBy: 'day' },
            now
        );

        expect(ranges.selected.from).toEqual(new Date(2026, 4, 1, 0, 0, 0, 0));
        expect(ranges.selected.to).toEqual(now);
        expect(ranges.previousPeriod.from).toEqual(
            new Date(2026, 3, 1, 0, 0, 0, 0)
        );
        expect(ranges.previousPeriod.to).toEqual(
            new Date(2026, 3, 10, 12, 34, 0, 0)
        );
        expect(ranges.previousYear.from).toEqual(
            new Date(2025, 4, 1, 0, 0, 0, 0)
        );
        expect(ranges.previousYear.to).toEqual(
            new Date(2025, 4, 10, 12, 34, 0, 0)
        );
    });

    it('compares last month with the full month before it', () => {
        const ranges = resolveStatsRanges(
            { timeframe: 'last-month', groupBy: 'day' },
            new Date(2026, 4, 10, 12, 34, 0, 0)
        );

        expect(ranges.selected.from).toEqual(new Date(2026, 3, 1, 0, 0, 0, 0));
        expect(ranges.selected.to).toEqual(
            new Date(2026, 3, 30, 23, 59, 59, 999)
        );
        expect(ranges.previousPeriod.from).toEqual(
            new Date(2026, 2, 1, 0, 0, 0, 0)
        );
        expect(ranges.previousPeriod.to).toEqual(
            new Date(2026, 2, 31, 23, 59, 59, 999)
        );
    });

    it('compares rolling presets with the same shifted window', () => {
        const ranges = resolveStatsRanges(
            { timeframe: 'last-7-days', groupBy: 'day' },
            new Date(2026, 4, 10, 12, 34, 0, 0)
        );

        expect(ranges.selected.from).toEqual(new Date(2026, 4, 4, 0, 0, 0, 0));
        expect(ranges.selected.to).toEqual(new Date(2026, 4, 10, 12, 34, 0, 0));
        expect(ranges.previousPeriod.from).toEqual(
            new Date(2026, 3, 27, 0, 0, 0, 0)
        );
        expect(ranges.previousPeriod.to).toEqual(
            new Date(2026, 4, 3, 12, 34, 0, 0)
        );
    });

    it('uses dashboard-style periods when stats period controls are supplied', () => {
        const ranges = resolveStatsRanges(
            {
                groupBy: 'week',
                period: 'month',
                date: new Date(2026, 4, 10, 12, 34, 0, 0)
            },
            new Date(2026, 4, 10, 12, 34, 0, 0)
        );

        expect(ranges.selected.from).toEqual(new Date(2026, 4, 1, 0, 0, 0, 0));
        expect(ranges.selected.to).toEqual(new Date(2026, 4, 10, 12, 34, 0, 0));
        expect(ranges.previousPeriod.from).toEqual(
            new Date(2026, 3, 1, 0, 0, 0, 0)
        );
        expect(ranges.previousPeriod.to).toEqual(
            new Date(2026, 3, 30, 23, 59, 59, 999)
        );
    });
});

describe('category trend ranges and summaries', () => {
    const category = {
        id: 7,
        userId: 1,
        name: 'Groceries',
        type: 'expense',
        createdAt: new Date('2024-01-15T12:00:00.000Z'),
        updatedAt: new Date('2024-01-15T12:00:00.000Z')
    } as const;

    function transaction(overrides: {
        readonly id: number;
        readonly amount: string;
        readonly effect?: 'normal' | 'reversal';
        readonly occurredAt: Date;
    }) {
        return {
            id: overrides.id,
            userId: 1,
            categoryId: category.id,
            type: 'expense',
            effect: overrides.effect ?? 'normal',
            amount: overrides.amount,
            currency: 'USD',
            defaultCurrencyAmount: overrides.amount,
            defaultCurrency: 'USD',
            exchangeRate: '1',
            exchangeRateDate: '2026-05-01',
            occurredAt: overrides.occurredAt,
            createdAt: overrides.occurredAt,
            updatedAt: overrides.occurredAt
        } as const;
    }

    it('defaults category trends to the last twelve calendar months', () => {
        const now = new Date('2026-05-30T12:00:00.000Z');

        expect(
            resolveCategoryTrendRange(
                { range: 'last-12-months' },
                { categoryCreatedAt: category.createdAt, now }
            )
        ).toEqual({
            from: new Date('2025-06-01T00:00:00.000Z'),
            to: now
        });
    });

    it('normalizes reversed custom category trend ranges', () => {
        expect(
            resolveCategoryTrendRange(
                {
                    range: 'custom',
                    from: new Date('2026-05-20T12:00:00.000Z'),
                    to: new Date('2026-05-10T12:00:00.000Z')
                },
                {
                    categoryCreatedAt: category.createdAt,
                    now: new Date('2026-05-30T12:00:00.000Z')
                }
            )
        ).toEqual({
            from: new Date('2026-05-10T00:00:00.000Z'),
            to: new Date('2026-05-20T23:59:59.999Z')
        });
    });

    it('uses the first category transaction for all-time trends', () => {
        const rows = [
            transaction({
                id: 2,
                amount: '12',
                occurredAt: new Date('2026-03-10T12:00:00.000Z')
            }),
            transaction({
                id: 1,
                amount: '12',
                occurredAt: new Date('2025-02-10T12:00:00.000Z')
            })
        ];
        const now = new Date('2026-05-30T12:00:00.000Z');

        expect(
            resolveCategoryTrendRange(
                { range: 'all-time' },
                { categoryCreatedAt: category.createdAt, now, rows }
            )
        ).toEqual({
            from: new Date('2025-02-10T00:00:00.000Z'),
            to: now
        });
    });

    it('summarizes category trend buckets with reversal offsets', () => {
        const range = {
            from: new Date('2026-05-01T00:00:00.000Z'),
            to: new Date('2026-05-31T23:59:59.999Z')
        };
        const response = summarizeCategoryTrendRows({
            category,
            currency: 'USD',
            groupBy: 'month',
            range,
            rows: [
                transaction({
                    id: 1,
                    amount: '12.34',
                    occurredAt: new Date('2026-05-10T12:00:00.000Z')
                }),
                transaction({
                    id: 2,
                    amount: '2.34',
                    effect: 'reversal',
                    occurredAt: new Date('2026-05-11T12:00:00.000Z')
                })
            ],
            timeFrame: 'custom'
        });

        expect(response.total).toBe(10);
        expect(response.transactionCount).toBe(2);
        expect(response.densityExceeded).toBe(false);
        expect(response.trend).toHaveLength(1);
        expect(response.trend[0]?.total).toBe(10);
        expect(response.trend[0]?.transactionCount).toBe(2);
    });

    it('omits chart points when category trend buckets exceed the cap', () => {
        const response = summarizeCategoryTrendRows({
            category,
            currency: 'USD',
            groupBy: 'day',
            range: {
                from: new Date('2025-01-01T00:00:00.000Z'),
                to: new Date('2026-06-01T00:00:00.000Z')
            },
            rows: [],
            timeFrame: 'custom'
        });

        expect(response.bucketCount).toBeGreaterThan(categoryTrendMaxBuckets);
        expect(response.densityExceeded).toBe(true);
        expect(response.trend).toEqual([]);
    });
});

describe('dashboard range resolution', () => {
    it('defaults a day range to the current day up to now', () => {
        const now = new Date(2026, 4, 10, 12, 34, 0, 0);
        const range = resolveDashboardRange('day', now, now);

        expect(range.from).toEqual(new Date(2026, 4, 10, 0, 0, 0, 0));
        expect(range.to).toEqual(now);
    });

    it('resolves a selected day to the full calendar day', () => {
        const range = resolveDashboardRange(
            'day',
            new Date(2026, 4, 5, 8, 0, 0, 0),
            new Date(2026, 4, 10, 12, 34, 0, 0)
        );

        expect(range.from).toEqual(new Date(2026, 4, 5, 0, 0, 0, 0));
        expect(range.to).toEqual(new Date(2026, 4, 5, 23, 59, 59, 999));
    });

    it('resolves calendar days in the user timezone', () => {
        const range = resolveDashboardRange(
            'day',
            new Date('2026-05-10T12:00:00.000Z'),
            new Date('2026-05-12T12:00:00.000Z'),
            'America/Los_Angeles'
        );

        expect(range.from).toEqual(new Date('2026-05-10T07:00:00.000Z'));
        expect(range.to).toEqual(new Date('2026-05-11T06:59:59.999Z'));
    });

    it('uses Monday through Sunday for selected weeks', () => {
        const range = resolveDashboardRange(
            'week',
            new Date(2026, 4, 13, 8, 0, 0, 0),
            new Date(2026, 4, 20, 12, 34, 0, 0)
        );

        expect(range.from).toEqual(new Date(2026, 4, 11, 0, 0, 0, 0));
        expect(range.to).toEqual(new Date(2026, 4, 17, 23, 59, 59, 999));
    });

    it('resolves full month, quarter, and year periods from an anchor date', () => {
        const now = new Date(2026, 7, 20, 12, 34, 0, 0);

        expect(
            resolveDashboardRange('month', new Date(2026, 4, 13), now)
        ).toEqual({
            from: new Date(2026, 4, 1, 0, 0, 0, 0),
            to: new Date(2026, 4, 31, 23, 59, 59, 999)
        });
        expect(
            resolveDashboardRange('quarter', new Date(2026, 4, 13), now)
        ).toEqual({
            from: new Date(2026, 3, 1, 0, 0, 0, 0),
            to: new Date(2026, 5, 30, 23, 59, 59, 999)
        });
        expect(
            resolveDashboardRange('year', new Date(2025, 4, 13), now)
        ).toEqual({
            from: new Date(2025, 0, 1, 0, 0, 0, 0),
            to: new Date(2025, 11, 31, 23, 59, 59, 999)
        });
    });

    it('resolves previous full calendar quarters for dashboard comparisons', () => {
        const range = resolveDashboardRange(
            'quarter',
            new Date(2026, 4, 13),
            new Date(2026, 7, 20, 12, 34, 0, 0)
        );

        expect(resolveDashboardComparisonRange('quarter', range)).toEqual({
            from: new Date(2026, 0, 1, 0, 0, 0, 0),
            to: new Date(2026, 2, 31, 23, 59, 59, 999)
        });
    });

    it('uses the previous full calendar month for in-progress month comparisons', () => {
        const range = resolveDashboardRange(
            'month',
            new Date(2026, 4, 10, 12, 34, 0, 0),
            new Date(2026, 4, 10, 12, 34, 0, 0)
        );

        expect(resolveDashboardComparisonRange('month', range)).toEqual({
            from: new Date(2026, 3, 1, 0, 0, 0, 0),
            to: new Date(2026, 3, 30, 23, 59, 59, 999)
        });
    });

    it('resolves balanced dashboard period windows without future periods', () => {
        const dates = resolveDashboardPeriodWindow(
            'month',
            new Date('2026-03-15T12:00:00.000Z'),
            new Date('2026-05-10T12:00:00.000Z'),
            'UTC'
        );

        expect(dates.map(date => date.toISOString().slice(0, 10))).toEqual([
            '2026-01-01',
            '2026-02-01',
            '2026-03-01',
            '2026-04-01',
            '2026-05-01'
        ]);
    });

    it('clamps dashboard period window side sizes', () => {
        const dates = resolveDashboardPeriodWindow(
            'day',
            new Date('2026-05-06T12:00:00.000Z'),
            new Date('2026-05-10T12:00:00.000Z'),
            'UTC',
            99,
            99
        );

        expect(dates.map(date => date.toISOString().slice(0, 10))).toEqual([
            '2026-05-02',
            '2026-05-03',
            '2026-05-04',
            '2026-05-05',
            '2026-05-06',
            '2026-05-07',
            '2026-05-08',
            '2026-05-09',
            '2026-05-10'
        ]);
    });

    it('uses dashboard period groupings for stats windows', () => {
        expect(dashboardStatsGroupBy('day')).toBe('hour');
        expect(dashboardStatsGroupBy('week')).toBe('day');
        expect(dashboardStatsGroupBy('month')).toBe('week');
        expect(dashboardStatsGroupBy('quarter')).toBe('week');
        expect(dashboardStatsGroupBy('year')).toBe('month');
    });
});

describe('percentage changes', () => {
    it('calculates percentage change against the previous total', () => {
        expect(percentChange(150, 100)).toBe(50);
        expect(percentChange(75, 100)).toBe(-25);
        expect(percentChange(0, 100)).toBe(-100);
    });

    it('uses a finite fallback when the previous total is zero', () => {
        expect(percentChange(100, 0)).toBe(100);
        expect(percentChange(-100, 0)).toBe(-100);
        expect(percentChange(0, 0)).toBe(0);
    });
});
