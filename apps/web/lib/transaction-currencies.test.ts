import { describe, expect, it } from 'vitest';
import { transactionCurrencyOptions } from './transaction-currencies';

const currencies = [
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'Pound Sterling' }
];

describe('transactionCurrencyOptions', () => {
    it('uses the default currency when no transaction currencies are configured', () => {
        expect(transactionCurrencyOptions(currencies, 'USD', [])).toEqual([
            { code: 'USD', name: 'US Dollar' }
        ]);
    });

    it('preserves configured order and removes duplicates', () => {
        expect(
            transactionCurrencyOptions(currencies, 'USD', ['EUR', 'USD', 'EUR'])
        ).toEqual([
            { code: 'EUR', name: 'Euro' },
            { code: 'USD', name: 'US Dollar' }
        ]);
    });

    it('keeps unknown currency codes available as fallbacks', () => {
        expect(transactionCurrencyOptions(currencies, 'USD', ['UAH'])).toEqual([
            { code: 'UAH', name: 'UAH' }
        ]);
    });
});
