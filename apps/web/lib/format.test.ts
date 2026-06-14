import { describe, expect, it } from 'vitest';
import {
    amountClassNameForCategoryTotal,
    amountClassNameForTransaction,
    amountClassNameForType,
    amountClassNameForValue,
    directionBadgeClassName,
    formatAmount,
    formatCategoryTotalMoney,
    formatDate,
    formatDateTime,
    formatDirectionalMoney,
    formatMoney,
    formatPercent,
    formatPreviousPeriodPercentChange,
    formatSignedPercent,
    formatTransactionMoney,
    percentChangeClassNameForCategory,
    percentChangeClassNameForMetric,
    percentChangeFromPrevious,
    signedAmountForTransaction,
    signedAmountForType,
    signedCategoryTotal
} from './format';

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

    it('applies directional signs from the reported transaction type', () => {
        expect(signedAmountForType(12.34, 'expense')).toBe(-12.34);
        expect(signedAmountForType(12.34, 'income')).toBe(12.34);
        expect(signedAmountForTransaction(12.34, 'expense')).toBe(-12.34);
        expect(signedAmountForTransaction(12.34, 'expense', 'offset')).toBe(
            -12.34
        );
        expect(signedAmountForTransaction(12.34, 'income', 'offset')).toBe(
            12.34
        );
        expect(formatDirectionalMoney(12.34, 'USD', 'expense')).toBe('-$12.34');
        expect(formatTransactionMoney(12.34, 'USD', 'income', 'offset')).toBe(
            '$12.34'
        );
    });

    it('formats category totals from the category perspective', () => {
        expect(signedCategoryTotal(50, 'expense')).toBe(-50);
        expect(signedCategoryTotal(50, 'income')).toBe(50);
        expect(formatCategoryTotalMoney(50, 'USD', 'expense')).toBe('-$50.00');
    });
});

describe('date and percent formatting', () => {
    it('formats valid dates and hides invalid dates', () => {
        expect(formatDate('2026-05-10T13:30:00.000Z', 'UTC')).toBe('5/10/2026');
        expect(formatDateTime('invalid date', 'UTC')).toBe('');
    });

    it('formats signed percentages', () => {
        expect(formatPercent(12.34)).toBe('12.3%');
        expect(formatSignedPercent(12.34)).toBe('+12.3%');
        expect(formatSignedPercent(-12.34)).toBe('-12.3%');
    });

    it('formats previous-period percentage changes', () => {
        expect(percentChangeFromPrevious(150, 100)).toBe(50);
        expect(percentChangeFromPrevious(75, 100)).toBe(-25);
        expect(percentChangeFromPrevious(100, 0)).toBe(100);
        expect(percentChangeFromPrevious(0, 0)).toBe(0);
        expect(formatPreviousPeriodPercentChange(150, 100)).toBe('+50%');
    });
});

describe('semantic class helpers', () => {
    it('maps values, types, and category kinds to stable class groups', () => {
        expect(amountClassNameForValue(-1)).toContain('rose');
        expect(amountClassNameForValue(1)).toContain('emerald');
        expect(amountClassNameForValue(0)).toBe('text-muted-foreground');
        expect(amountClassNameForType('expense')).toContain('rose');
        expect(amountClassNameForTransaction(1, 'expense')).toContain('rose');
        expect(amountClassNameForTransaction(1, 'income', 'offset')).toContain(
            'emerald'
        );
        expect(amountClassNameForCategoryTotal(1, 'expense')).toContain('rose');
        expect(directionBadgeClassName('income')).toContain('emerald');
        expect(percentChangeClassNameForCategory(10, 'expense')).toContain(
            'rose'
        );
        expect(percentChangeClassNameForMetric(10, 'expense')).toContain(
            'rose'
        );
        expect(percentChangeClassNameForMetric(-10, 'expense')).toContain(
            'emerald'
        );
        expect(percentChangeClassNameForMetric(10, 'income')).toContain(
            'emerald'
        );
        expect(percentChangeClassNameForMetric(-10, 'net')).toContain('rose');
    });
});
