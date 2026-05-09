import { describe, expect, it } from 'vitest';
import { convertAmount, transactionDate } from './currencies.js';

describe('currency calculations', () => {
    it('rounds converted amounts to cents', () => {
        expect(convertAmount(12.345, 1.2345)).toBe(15.24);
    });

    it('uses the transaction calendar date for historical rates', () => {
        expect(transactionDate(new Date('2026-05-09T18:30:00.000Z'))).toBe(
            '2026-05-09'
        );
    });
});
