import { describe, expect, it } from 'vitest';
import {
    compareTransactionsByOccurrenceDesc,
    resolveStatsRanges,
    TransactionCategoryError,
    TransactionNotFoundError
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
