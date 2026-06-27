import type { Currency } from '@xpenser/contracts';

export function dashboardCurrencyCodes(
    defaultCurrency: string,
    favoriteCurrencies: readonly string[]
): string[] {
    return Array.from(
        new Set(
            [defaultCurrency, ...favoriteCurrencies]
                .map(currency => currency.trim().toUpperCase())
                .filter(currency => /^[A-Z]{3}$/.test(currency))
        )
    );
}

export function selectedDashboardCurrency(
    requestedCurrency: string | undefined,
    defaultCurrency: string,
    favoriteCurrencies: readonly string[]
): string {
    const allowedCurrencies = dashboardCurrencyCodes(
        defaultCurrency,
        favoriteCurrencies
    );
    const requested = requestedCurrency?.trim().toUpperCase();
    return requested && allowedCurrencies.includes(requested)
        ? requested
        : (allowedCurrencies[0] ?? defaultCurrency.trim().toUpperCase());
}

export function dashboardCurrencyOptions(
    currencies: readonly Currency[],
    defaultCurrency: string,
    favoriteCurrencies: readonly string[]
): Currency[] {
    const currenciesByCode = new Map(
        currencies.map(currency => [currency.code, currency] as const)
    );

    return dashboardCurrencyCodes(defaultCurrency, favoriteCurrencies).map(
        code => currenciesByCode.get(code) ?? { code, name: code }
    );
}
