import { describe, expect, it } from 'vitest';
import {
    isRetryableStatus,
    parseCategoryTypes,
    parseCsvLine,
    parseTransactionRow,
    progressLine,
    retryDelayMs,
    selectRows,
    summarizeRows
} from './import-transactions.mjs';

const categoryTypes = new Map([
    ['Food', 'expense'],
    ['Salary', 'income']
]);

describe('historical transaction import helpers', () => {
    it('parses category type lines', () => {
        expect(
            parseCategoryTypes('Food - expense\nSalary - income')
        ).toEqual(categoryTypes);
    });

    it('parses CSV quotes and escaped quotes', () => {
        expect(parseCsvLine('a,"b,c","d""e"')).toEqual([
            'a',
            'b,c',
            'd"e'
        ]);
    });

    it('normalizes expense rows for API create bodies', () => {
        expect(
            parseTransactionRow(
                '2020-03-20T12:05:32.040Z,Food,50.00,27.00,UAH,',
                1,
                categoryTypes
            )
        ).toMatchObject({
            rowNumber: 1,
            timestamp: '2020-03-20T12:05:32.040Z',
            categoryName: 'Food',
            categoryType: 'expense',
            signedAmount: 50,
            amount: 50,
            exchangeRateToUsd: 27,
            currency: 'UAH',
            note: undefined
        });
    });

    it('keeps positive income rows as positive import magnitudes', () => {
        expect(
            parseTransactionRow(
                '2020-03-20T12:21:37.699Z,Salary,250.00,1.00,USD,Chargeback',
                4,
                categoryTypes
            )
        ).toMatchObject({
            amount: 250,
            note: 'Chargeback'
        });
    });

    it('joins extra columns into the note', () => {
        expect(
            parseTransactionRow(
                '2020-03-20T12:21:37.699Z,Salary,-250.00,1.00,USD,Bonus, from James',
                5,
                categoryTypes
            ).note
        ).toBe('Bonus, from James');
    });

    it('marks zero amount rows as skipped', () => {
        expect(
            parseTransactionRow(
                '2020-03-20T14:20:07.822Z,Salary,0.00,1.00,USD,wolf february',
                17,
                categoryTypes
            )
        ).toMatchObject({
            amount: 0,
            skipReason: 'zero_amount'
        });
    });

    it('summarizes rows by importability and currency', () => {
        const rows = [
            parseTransactionRow(
                '2020-03-20T12:05:32.040Z,Food,50.00,27.00,UAH,',
                1,
                categoryTypes
            ),
            parseTransactionRow(
                '2020-03-20T12:21:37.699Z,Salary,250.00,1.00,USD,',
                2,
                categoryTypes
            ),
            parseTransactionRow(
                '2020-03-20T14:20:07.822Z,Salary,0.00,1.00,USD,wolf february',
                3,
                categoryTypes
            )
        ];

        const summary = summarizeRows(rows);
        expect(summary.total).toBe(3);
        expect(summary.importable).toBe(2);
        expect(summary.skipped).toBe(1);
        expect(summary.currencies.get('UAH')).toBe(1);
        expect(summary.currencies.get('USD')).toBe(2);
        expect(summary.skipReasons.get('zero_amount')).toBe(1);
    });

    it('selects newest rows first by default and resumes downward', () => {
        const rows = [1, 2, 3, 4, 5].map(rowNumber => ({ rowNumber }));

        expect(selectRows(rows).map(row => row.rowNumber)).toEqual([
            5,
            4,
            3,
            2,
            1
        ]);
        expect(
            selectRows(rows, { limit: 2, startRow: 3 }).map(
                row => row.rowNumber
            )
        ).toEqual([3, 2]);
    });

    it('can select oldest rows first when requested', () => {
        const rows = [1, 2, 3, 4, 5].map(rowNumber => ({ rowNumber }));

        expect(
            selectRows(rows, {
                limit: 2,
                order: 'asc',
                startRow: 3
            }).map(row => row.rowNumber)
        ).toEqual([3, 4]);
    });

    it('classifies retryable failures without retrying validation errors', () => {
        expect(isRetryableStatus(undefined)).toBe(true);
        expect(isRetryableStatus(408)).toBe(true);
        expect(isRetryableStatus(429)).toBe(true);
        expect(isRetryableStatus(500)).toBe(true);
        expect(isRetryableStatus(504)).toBe(true);
        expect(isRetryableStatus(400)).toBe(false);
        expect(isRetryableStatus(404)).toBe(false);
    });

    it('backs off retry attempts and respects retry-after delay', () => {
        expect(retryDelayMs(1, 1000)).toBe(1000);
        expect(retryDelayMs(3, 1000)).toBe(4000);
        expect(retryDelayMs(1, 1000, 2500)).toBe(2500);
    });

    it('formats progress with row number, elapsed time, and ETA', () => {
        expect(progressLine(50, 100, 120, 0, 10_000)).toBe(
            'Inserted 50/100 (50.0%) | CSV row 120 | 10s elapsed | ETA 10s | 5.0 rows/s'
        );
    });
});
