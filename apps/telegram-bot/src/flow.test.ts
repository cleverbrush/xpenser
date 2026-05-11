import type { Currency, UserPreference } from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import {
    isKnownCurrency,
    normalizeCurrencyCode,
    parseAmount,
    parseStartToken,
    preferredCurrencies
} from './flow.js';

describe('telegram bot flow helpers', () => {
    it('extracts Telegram deep-link start tokens', () => {
        expect(parseStartToken('/start abc123')).toBe('abc123');
        expect(parseStartToken('/start@xpenser_bot abc123')).toBe('abc123');
        expect(parseStartToken('/start')).toBeUndefined();
    });

    it('parses positive decimal amounts', () => {
        expect(parseAmount('12')).toBe(12);
        expect(parseAmount('12.50')).toBe(12.5);
        expect(parseAmount('12,50')).toBe(12.5);
        expect(parseAmount('1234.56')).toBe(1234.56);
        expect(parseAmount('1234,56')).toBe(1234.56);
        expect(parseAmount('0')).toBeUndefined();
        expect(parseAmount('-1')).toBeUndefined();
        expect(parseAmount('12.345')).toBeUndefined();
        expect(parseAmount('12,345')).toBeUndefined();
    });

    it('builds preferred currency choices from profile and available currencies', () => {
        const me = {
            defaultCurrency: 'USD',
            favoriteCurrencies: ['EUR', 'USD', 'GBP']
        } as UserPreference;
        const currencies = [
            { code: 'USD', name: 'US Dollar' },
            { code: 'EUR', name: 'Euro' }
        ] as Currency[];

        expect(preferredCurrencies(me, currencies)).toEqual(['USD', 'EUR']);
    });

    it('normalizes and validates currency codes', () => {
        const currencies = [{ code: 'USD', name: 'US Dollar' }] as Currency[];

        expect(normalizeCurrencyCode(' usd ')).toBe('USD');
        expect(isKnownCurrency('USD', currencies)).toBe(true);
        expect(isKnownCurrency('EUR', currencies)).toBe(false);
    });
});
