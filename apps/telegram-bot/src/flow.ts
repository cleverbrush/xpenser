import type {
    Category,
    Currency,
    Transaction,
    UserPreference
} from '@xpenser/contracts';

export const cancelCallback = 'cancel';
export const noteSkipCallback = 'note:skip';
export const noteAddCallback = 'note:add';
export const reversalNoCallback = 'reversal:no';
export const reversalYesCallback = 'reversal:yes';
export const addCommand = '/add';
export const addButtonText = 'Add';

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

export function reversalKeyboard(): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [
                { text: 'No', callback_data: reversalNoCallback },
                { text: 'Yes, reversal', callback_data: reversalYesCallback }
            ],
            [{ text: 'Cancel', callback_data: cancelCallback }]
        ]
    };
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
