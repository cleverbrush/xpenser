import { describe, expect, it } from 'vitest';
import {
    compareTransactionsByOccurrenceAsc,
    compareTransactionsByOccurrenceDesc,
    percentChange,
    resolveDashboardComparisonRange,
    resolveDashboardRange,
    resolveStatsRanges,
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
