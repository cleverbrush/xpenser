import type { Currency, UserPreference } from '@xpenser/contracts';

export const cancelCallback = 'cancel';
export const noteSkipCallback = 'note:skip';
export const noteAddCallback = 'note:add';
export const addCommand = '/add';

type InlineKeyboardButton = {
    readonly text: string;
    readonly callback_data: string;
};

type InlineKeyboardMarkup = {
    readonly inline_keyboard: InlineKeyboardButton[][];
};

export function quickAddReplyKeyboard() {
    return {
        keyboard: [[{ text: addCommand }]],
        is_persistent: true,
        resize_keyboard: true,
        input_field_placeholder: 'Tap /add to record a transaction'
    };
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
    return Array.from(
        new Set([me.defaultCurrency, ...me.favoriteCurrencies])
    ).filter(currency => available.has(currency));
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
