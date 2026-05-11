import type { Currency, UserPreference } from '@xpenser/contracts';

export const cancelCallback = 'cancel';
export const noteSkipCallback = 'note:skip';
export const noteAddCallback = 'note:add';
export const currencyOtherCallback = 'cur:other';

export function parseStartToken(text: string | undefined): string | undefined {
    const [, token] =
        (text ?? '').trim().match(/^\/start(?:@\S+)?\s+(\S+)$/) ?? [];
    return token;
}

export function parseAmount(text: string | undefined): number | undefined {
    const normalized = (text ?? '').trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
        return undefined;
    }

    const amount = Number(normalized);
    return amount > 0 ? amount : undefined;
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

export function normalizeCurrencyCode(text: string | undefined): string {
    return (text ?? '').trim().toUpperCase();
}

export function isKnownCurrency(
    code: string,
    currencies: readonly Currency[]
): boolean {
    return currencies.some(currency => currency.code === code);
}
