import type { Currency } from '@xpenser/contracts';

export function transactionCurrencyOptions(
    currencies: readonly Currency[],
    defaultCurrency: string,
    transactionCurrencies: readonly string[]
): Currency[] {
    const currenciesByCode = new Map(
        currencies.map(currency => [currency.code, currency] as const)
    );
    const selectedCurrencyCodes = Array.from(
        new Set(
            transactionCurrencies.length > 0
                ? transactionCurrencies
                : [defaultCurrency]
        )
    );

    return selectedCurrencyCodes.map(
        code => currenciesByCode.get(code) ?? { code, name: code }
    );
}
