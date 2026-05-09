import type { Currency } from '@xpenser/contracts';
import type { Knex } from 'knex';
import type { Config } from '../config.js';

const fallbackCurrencies: readonly Currency[] = [
    { code: 'USD', name: 'United States Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'CAD', name: 'Canadian Dollar' },
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'JPY', name: 'Japanese Yen' }
];

type FrankfurterCurrencyResponse =
    | Record<string, string>
    | Array<{ code: string; name: string }>;

type FrankfurterRateResponse = {
    readonly date?: string;
    readonly rate?: number;
};

export type ExchangeRate = {
    readonly rate: number;
    readonly rateDate: string;
};

export function transactionDate(value: Date): string {
    return value.toISOString().slice(0, 10);
}

export function convertAmount(amount: number, rate: number): number {
    return Math.round(amount * rate * 100) / 100;
}

export async function listCurrencies(config: Config): Promise<Currency[]> {
    try {
        const response = await fetch(
            `${config.frankfurter.baseUrl}/currencies`
        );
        if (!response.ok) {
            return [...fallbackCurrencies];
        }

        const payload = (await response.json()) as FrankfurterCurrencyResponse;
        if (Array.isArray(payload)) {
            return payload
                .map(item => ({ code: item.code, name: item.name }))
                .sort((a, b) => a.code.localeCompare(b.code));
        }

        return Object.entries(payload)
            .map(([code, name]) => ({ code, name }))
            .sort((a, b) => a.code.localeCompare(b.code));
    } catch {
        return [...fallbackCurrencies];
    }
}

export async function getExchangeRate(
    knex: Knex,
    config: Config,
    baseCurrency: string,
    quoteCurrency: string,
    date: string
): Promise<ExchangeRate> {
    if (baseCurrency === quoteCurrency) {
        return { rate: 1, rateDate: date };
    }

    const cached = await knex('exchange_rates')
        .where({
            base_currency: baseCurrency,
            quote_currency: quoteCurrency,
            rate_date: date
        })
        .first<{ rate: string | number; rate_date: string }>();

    if (cached) {
        return {
            rate: Number(cached.rate),
            rateDate: String(cached.rate_date)
        };
    }

    const params = new URLSearchParams({ date });
    const response = await fetch(
        `${config.frankfurter.baseUrl}/rate/${baseCurrency}/${quoteCurrency}?${params}`
    );
    if (!response.ok) {
        throw new Error(
            `Could not fetch ${baseCurrency}/${quoteCurrency} rate.`
        );
    }

    const payload = (await response.json()) as FrankfurterRateResponse;
    if (typeof payload.rate !== 'number') {
        throw new Error(
            `Frankfurter returned no ${baseCurrency}/${quoteCurrency} rate.`
        );
    }

    const rateDate = payload.date ?? date;
    await knex('exchange_rates')
        .insert({
            base_currency: baseCurrency,
            quote_currency: quoteCurrency,
            rate_date: rateDate,
            rate: payload.rate
        })
        .onConflict(['base_currency', 'quote_currency', 'rate_date'])
        .ignore();

    return { rate: payload.rate, rateDate };
}
