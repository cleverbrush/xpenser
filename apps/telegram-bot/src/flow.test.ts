import type { Currency, UserPreference } from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import {
    addCommand,
    currencyKeyboard,
    parseAmount,
    parseStartToken,
    preferredCurrencies,
    quickAddReplyKeyboard
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

    it('builds a persistent quick-add reply keyboard', () => {
        expect(quickAddReplyKeyboard()).toMatchObject({
            keyboard: [[{ text: addCommand }]],
            is_persistent: true,
            resize_keyboard: true
        });
    });

    it('builds currency buttons only from default and favorites', () => {
        const me = {
            defaultCurrency: 'USD',
            favoriteCurrencies: ['EUR']
        } as UserPreference;
        const currencies = [
            { code: 'USD', name: 'US Dollar' },
            { code: 'EUR', name: 'Euro' },
            { code: 'GBP', name: 'Pound Sterling' }
        ] as Currency[];

        expect(currencyKeyboard(me, currencies).inline_keyboard).toEqual([
            [{ text: 'USD', callback_data: 'cur:USD' }],
            [{ text: 'EUR', callback_data: 'cur:EUR' }],
            [{ text: 'Cancel', callback_data: 'cancel' }]
        ]);
    });
});
