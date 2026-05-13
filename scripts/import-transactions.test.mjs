import { describe, expect, it } from 'vitest';
import {
    effectForSignedAmount,
    parseCategoryTypes,
    parseCsvLine,
    parseTransactionRow,
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

    it('maps sign/type combinations to transaction effects', () => {
        expect(effectForSignedAmount('expense', 10)).toBe('normal');
        expect(effectForSignedAmount('expense', -10)).toBe('reversal');
        expect(effectForSignedAmount('income', -10)).toBe('normal');
        expect(effectForSignedAmount('income', 10)).toBe('reversal');
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
            effect: 'normal',
            note: undefined
        });
    });

    it('uses reversal for income rows with positive signs', () => {
        expect(
            parseTransactionRow(
                '2020-03-20T12:21:37.699Z,Salary,250.00,1.00,USD,Chargeback',
                4,
                categoryTypes
            )
        ).toMatchObject({
            amount: 250,
            effect: 'reversal',
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
            effect: 'normal',
            skipReason: 'zero_amount'
        });
    });

    it('summarizes rows by effect and currency', () => {
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
        expect(summary.normal).toBe(1);
        expect(summary.reversal).toBe(1);
        expect(summary.currencies.get('UAH')).toBe(1);
        expect(summary.currencies.get('USD')).toBe(2);
        expect(summary.skipReasons.get('zero_amount')).toBe(1);
    });
});
