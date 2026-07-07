import type {
    Category,
    Currency,
    Transaction,
    UserPreference,
    Vendor
} from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import {
    addButtonText,
    categoriesByRecentUse,
    categoriesWithPreferredFirst,
    currencyKeyboard,
    filteredVendors,
    isAddButtonText,
    isAllowedScanImageMimeType,
    parseAmount,
    parseStartToken,
    parseTelegramDateTime,
    preferredCurrencies,
    quickAddReplyKeyboard,
    scanImageSizeError,
    vendorKeyboard,
    vendorSelectCallbackPrefix
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
            hasUploadedAvatar: false,
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
            hasUploadedAvatar: false,
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

    it('parses local Telegram date-time edits in the user timezone', () => {
        expect(
            parseTelegramDateTime(
                '2026-05-10 09:30',
                'America/New_York'
            )?.toISOString()
        ).toBe('2026-05-10T13:30:00.000Z');
        expect(
            parseTelegramDateTime(
                '2026-05-10T09:30',
                'America/New_York'
            )?.toISOString()
        ).toBe('2026-05-10T13:30:00.000Z');
        expect(parseTelegramDateTime('05/10/2026', 'UTC')).toBeUndefined();
    });

    it('validates supported scan image types and sizes', () => {
        expect(isAllowedScanImageMimeType('image/jpeg')).toBe(true);
        expect(isAllowedScanImageMimeType('image/png')).toBe(true);
        expect(isAllowedScanImageMimeType('image/webp')).toBe(true);
        expect(isAllowedScanImageMimeType('application/pdf')).toBe(false);
        expect(scanImageSizeError(10 * 1024 * 1024)).toBeUndefined();
        expect(scanImageSizeError(10 * 1024 * 1024 + 1)).toBe(
            'Image must be 10 MB or smaller.'
        );
    });

    it('filters and renders existing vendor choices', () => {
        const vendors = [
            {
                id: 1,
                name: 'Acme Groceries',
                displayName: 'Acme Groceries'
            },
            {
                id: 2,
                name: 'Coffee Bar',
                displayName: 'Coffee Bar',
                domain: 'coffee.example'
            }
        ] as Vendor[];

        expect(
            filteredVendors(vendors, 'coffee').map(vendor => vendor.id)
        ).toEqual([2]);
        expect(vendorKeyboard(vendors, 0).inline_keyboard).toContainEqual([
            {
                text: 'Acme Groceries',
                callback_data: `${vendorSelectCallbackPrefix}1`
            }
        ]);
    });

    it('moves a vendor suggested category to the front', () => {
        const categories = [
            { id: 1, displayName: 'Food', type: 'expense' },
            { id: 2, displayName: 'Coffee', type: 'expense' },
            { id: 3, displayName: 'Travel', type: 'expense' }
        ] as Category[];

        expect(
            categoriesWithPreferredFirst(categories, 2).map(
                category => category.id
            )
        ).toEqual([2, 1, 3]);
        expect(
            categoriesWithPreferredFirst(categories, 999).map(
                category => category.id
            )
        ).toEqual([1, 2, 3]);
    });

    it('sorts recently used categories first', () => {
        const categories = [
            {
                id: 1,
                name: 'Food',
                type: 'expense',
                parentId: null,
                kind: 'normal',
                displayName: 'Food',
                inUse: true,
                hasChildren: false,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: 2,
                name: 'House',
                type: 'expense',
                parentId: null,
                kind: 'normal',
                displayName: 'House',
                inUse: true,
                hasChildren: false,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: 3,
                name: 'Salary',
                type: 'income',
                parentId: null,
                kind: 'normal',
                displayName: 'Salary',
                inUse: true,
                hasChildren: false,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: 4,
                name: 'Travel',
                type: 'expense',
                parentId: null,
                kind: 'normal',
                displayName: 'Travel',
                inUse: true,
                hasChildren: false,
                createdAt: new Date(),
                updatedAt: new Date()
            }
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
