import { describe, expect, it } from 'vitest';
import { formatAmount, formatMoney } from './format';

describe('money formatting', () => {
    it('keeps money exact by default', () => {
        expect(formatMoney(23_543.33, 'USD')).toBe('$23,543.33');
    });

    it('shortens large amounts when compact formatting is requested', () => {
        expect(formatAmount(23_543.33, 'USD', { compact: true })).toBe(
            '$23.5k'
        );
        expect(formatAmount(-23_543.33, 'USD', { compact: true })).toBe(
            '-$23.5k'
        );
    });

    it('does not shorten smaller everyday amounts by default', () => {
        expect(formatAmount(9_999.99, 'USD', { compact: true })).toBe(
            '$9,999.99'
        );
    });
});
