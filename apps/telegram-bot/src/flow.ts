import type {
    Category,
    Currency,
    Transaction,
    TransactionScanDraft,
    UserPreference,
    Vendor
} from '@xpenser/contracts';
import { FieldLimits, TransactionScanLimits } from '@xpenser/contracts';
import { localDateTimeInputToDate } from '@xpenser/timezone';

export const cancelCallback = 'cancel';
export const noteSkipCallback = 'note:skip';
export const noteAddCallback = 'note:add';
export const vendorNoneCallback = 'vendor:none';
export const vendorSearchCallback = 'vendor:search';
export const vendorPageCallbackPrefix = 'vendorpage:';
export const vendorSelectCallbackPrefix = 'vendor:select:';
export const scanConfirmCallback = 'scan:confirm';
export const scanDiscardCallback = 'scan:discard';
export const scanPreviousCallback = 'scan:previous';
export const scanNextCallback = 'scan:next';
export const scanEditAmountCallback = 'scan:edit:amount';
export const scanEditCategoryCallback = 'scan:edit:category';
export const scanEditCurrencyCallback = 'scan:edit:currency';
export const scanEditDateCallback = 'scan:edit:date';
export const scanEditNoteCallback = 'scan:edit:note';
export const scanEditVendorCallback = 'scan:edit:vendor';
export const addCommand = '/add';
export const budgetCommand = '/budget';
export const budgetSelectCallbackPrefix = 'budget:';
export const addButtonText = 'Add';
export const allowedScanImageMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
] as const;
export const vendorPageSize = 6;

type InlineKeyboardButton = {
    readonly text: string;
    readonly callback_data: string;
};

type InlineKeyboardMarkup = {
    readonly inline_keyboard: InlineKeyboardButton[][];
};

export function quickAddReplyKeyboard() {
    return {
        keyboard: [[{ text: addButtonText }]],
        is_persistent: true,
        resize_keyboard: true,
        input_field_placeholder: 'Tap Add to record a transaction'
    };
}

export function isAddButtonText(text: string | undefined): boolean {
    return (text ?? '').trim().toLowerCase() === addButtonText.toLowerCase();
}

export function parseStartToken(text: string | undefined): string | undefined {
    const [, token] =
        (text ?? '').trim().match(/^\/start(?:@\S+)?\s+(\S+)$/) ?? [];
    return token;
}

export function parseAmount(text: string | undefined): number | undefined {
    const trimmed = (text ?? '').trim();
    if (!/^\d+(?:[,.]\d{1,2})?$/.test(trimmed)) {
        return undefined;
    }

    const normalized = trimmed.replace(',', '.');
    const amount = Number(normalized);
    return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

export function parseTelegramDateTime(
    text: string | undefined,
    timeZone: string
): Date | undefined {
    const normalized = (text ?? '').trim().replace(/\s+/, 'T');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
        return undefined;
    }
    return localDateTimeInputToDate(normalized, timeZone);
}

export function noteLengthError(text: string): string | undefined {
    return text.length > FieldLimits.transactionNote
        ? `Description is too long. Send up to ${FieldLimits.transactionNote} characters.`
        : undefined;
}

export function isAllowedScanImageMimeType(
    value: string | undefined
): value is (typeof allowedScanImageMimeTypes)[number] {
    return allowedScanImageMimeTypes.includes(
        value as (typeof allowedScanImageMimeTypes)[number]
    );
}

export function scanImageSizeError(
    fileSize: number | undefined
): string | undefined {
    if (fileSize === undefined) {
        return undefined;
    }
    if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
        return 'Choose an image to scan.';
    }
    if (fileSize > TransactionScanLimits.maxImageBytes) {
        return 'Image must be 10 MB or smaller.';
    }
    return undefined;
}

export function preferredCurrencies(
    me: UserPreference,
    currencies: readonly Currency[]
): string[] {
    const available = new Set(currencies.map(currency => currency.code));
    const configured =
        me.transactionCurrencies.length > 0
            ? me.transactionCurrencies
            : [me.defaultCurrency, ...me.favoriteCurrencies];
    return Array.from(new Set(configured)).filter(currency =>
        available.has(currency)
    );
}

export function currencyKeyboard(
    me: UserPreference,
    currencies: readonly Currency[]
): InlineKeyboardMarkup {
    const rows = preferredCurrencies(me, currencies).map(currency => [
        { text: currency, callback_data: `cur:${currency}` }
    ]);

    rows.push([{ text: 'Cancel', callback_data: cancelCallback }]);

    return { inline_keyboard: rows };
}

export function vendorLabel(vendor: Vendor): string {
    return vendor.displayName || vendor.resolvedName || vendor.name;
}

export function vendorMatches(vendor: Vendor, query: string): boolean {
    const search = query.trim().toLowerCase();
    if (!search) {
        return true;
    }

    return [
        vendor.name,
        vendor.displayName,
        vendor.resolvedName,
        vendor.domain,
        vendor.description
    ].some(value => value?.toLowerCase().includes(search));
}

export function filteredVendors(
    vendors: readonly Vendor[],
    query: string | undefined
): Vendor[] {
    return vendors.filter(vendor => vendorMatches(vendor, query ?? ''));
}

export function vendorKeyboard(
    vendors: readonly Vendor[],
    page: number,
    options: { readonly includeSearch?: boolean } = {}
): InlineKeyboardMarkup {
    const pageCount = Math.max(1, Math.ceil(vendors.length / vendorPageSize));
    const safePage = Math.min(Math.max(page, 0), pageCount - 1);
    const start = safePage * vendorPageSize;
    const rows = vendors.slice(start, start + vendorPageSize).map(vendor => [
        {
            text: vendorLabel(vendor),
            callback_data: `${vendorSelectCallbackPrefix}${vendor.id}`
        }
    ]);

    const navigation = [];
    if (safePage > 0) {
        navigation.push({
            text: 'Previous',
            callback_data: `${vendorPageCallbackPrefix}${safePage - 1}`
        });
    }
    if (safePage < pageCount - 1) {
        navigation.push({
            text: 'Next',
            callback_data: `${vendorPageCallbackPrefix}${safePage + 1}`
        });
    }
    if (navigation.length > 0) {
        rows.push(navigation);
    }
    if (options.includeSearch) {
        rows.push([
            { text: 'Search vendors', callback_data: vendorSearchCallback }
        ]);
    }
    rows.push([{ text: 'No vendor', callback_data: vendorNoneCallback }]);
    rows.push([{ text: 'Cancel', callback_data: cancelCallback }]);

    return { inline_keyboard: rows };
}

export function categoriesWithPreferredFirst(
    categories: readonly Category[],
    categoryId: number | undefined | null
): Category[] {
    if (!categoryId) {
        return [...categories];
    }
    const selected = categories.find(category => category.id === categoryId);
    if (!selected) {
        return [...categories];
    }
    return [
        selected,
        ...categories.filter(category => category.id !== selected.id)
    ];
}

export function draftCategoryType(
    draft: TransactionScanDraft,
    categories: readonly Category[]
): Category['type'] {
    const category = categories.find(item => item.id === draft.categoryId);
    return category?.type ?? draft.transactionType;
}

export function categoriesByRecentUse(
    categories: readonly Category[],
    transactions: readonly Transaction[]
): Category[] {
    const originalIndex = new Map(
        categories.map((category, index) => [category.id, index] as const)
    );
    const usage = new Map<number, { count: number; firstSeen: number }>();

    transactions.forEach((transaction, index) => {
        const current = usage.get(transaction.categoryId) ?? {
            count: 0,
            firstSeen: index
        };
        usage.set(transaction.categoryId, {
            count: current.count + 1,
            firstSeen: Math.min(current.firstSeen, index)
        });
    });

    return [...categories].sort((left, right) => {
        const leftUsage = usage.get(left.id);
        const rightUsage = usage.get(right.id);
        const usageDelta = (rightUsage?.count ?? 0) - (leftUsage?.count ?? 0);

        if (usageDelta !== 0) {
            return usageDelta;
        }
        if (
            leftUsage &&
            rightUsage &&
            leftUsage.firstSeen !== rightUsage.firstSeen
        ) {
            return leftUsage.firstSeen - rightUsage.firstSeen;
        }
        if (leftUsage && !rightUsage) {
            return -1;
        }
        if (!leftUsage && rightUsage) {
            return 1;
        }

        return (
            (originalIndex.get(left.id) ?? 0) -
            (originalIndex.get(right.id) ?? 0)
        );
    });
}
