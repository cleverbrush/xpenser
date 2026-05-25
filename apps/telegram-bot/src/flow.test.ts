import type {
    Category,
    Currency,
    Transaction,
    UserPreference
} from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import {
    addButtonText,
    categoriesByRecentUse,
    currencyKeyboard,
    isAddButtonText,
    parseAmount,
    parseStartToken,
    preferredCurrencies,
    quickAddReplyKeyboard,
    reversalKeyboard
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

    it('builds preferred currency choices from API popularity order', () => {
        const me = {
            defaultCurrency: 'USD',
            favoriteCurrencies: ['EUR', 'USD', 'GBP'],
            transactionCurrencies: ['EUR', 'USD', 'GBP']
        } as UserPreference;
        const currencies = [
            { code: 'USD', name: 'US Dollar' },
            { code: 'EUR', name: 'Euro' }
        ] as Currency[];

        expect(preferredCurrencies(me, currencies)).toEqual(['EUR', 'USD']);
    });

    it('builds a persistent quick-add reply keyboard', () => {
        expect(quickAddReplyKeyboard()).toMatchObject({
            keyboard: [[{ text: addButtonText }]],
            is_persistent: true,
            resize_keyboard: true
        });
        expect(isAddButtonText('Add')).toBe(true);
        expect(isAddButtonText('/add')).toBe(false);
    });

    it('builds currency buttons only from default and favorites', () => {
        const me = {
            defaultCurrency: 'USD',
            favoriteCurrencies: ['EUR'],
            transactionCurrencies: ['EUR', 'USD']
        } as UserPreference;
        const currencies = [
            { code: 'USD', name: 'US Dollar' },
            { code: 'EUR', name: 'Euro' },
            { code: 'GBP', name: 'Pound Sterling' }
        ] as Currency[];

        expect(currencyKeyboard(me, currencies).inline_keyboard).toEqual([
            [{ text: 'EUR', callback_data: 'cur:EUR' }],
            [{ text: 'USD', callback_data: 'cur:USD' }],
            [{ text: 'Cancel', callback_data: 'cancel' }]
        ]);
    });

    it('builds reversal choice buttons', () => {
        expect(reversalKeyboard().inline_keyboard).toEqual([
            [
                { text: 'No', callback_data: 'reversal:no' },
                { text: 'Yes, reversal', callback_data: 'reversal:yes' }
            ],
            [{ text: 'Cancel', callback_data: 'cancel' }]
        ]);
    });

    it('sorts recently used categories first', () => {
        const categories = [
            { id: 1, name: 'Food', type: 'expense' },
            { id: 2, name: 'House', type: 'expense' },
            { id: 3, name: 'Salary', type: 'income' },
            { id: 4, name: 'Travel', type: 'expense' }
        ] as Category[];
        const transactions = [
            { categoryId: 2 },
            { categoryId: 1 },
            { categoryId: 2 },
            { categoryId: 3 }
        ] as Transaction[];

        expect(
            categoriesByRecentUse(categories, transactions).map(
                category => category.id
            )
        ).toEqual([2, 1, 3, 4]);
    });
});
