import type { Logger } from '@cleverbrush/log';
import type {
    Currency,
    CurrencyConversion,
    CurrencyConversionQuery
} from '@xpenser/contracts';
import { dateToLocalDateParam, defaultTimeZone } from '@xpenser/timezone';
import type { Config } from '../config.js';
import type { AppDb, UserDb } from '../db/schemas.js';
import { frankfurterCurrencyCatalog } from './frankfurter-currency-catalog.js';

type FrankfurterCurrencyResponse =
    | Record<string, string>
    | Array<{ code?: string; iso_code?: string; name?: string }>;

type FrankfurterRateResponse = {
    readonly date?: string;
    readonly rate?: number;
};

export type ExchangeRate = {
    readonly rate: number;
    readonly rateDate: string;
};

export function transactionDate(
    value: Date,
    timeZone = defaultTimeZone
): string {
    return dateToLocalDateParam(value, timeZone);
}

export function convertAmount(amount: number, rate: number): number {
    return Math.round(amount * rate * 100) / 100;
}

function normalizeRateDate(value: unknown, fallback: string): string {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return transactionDate(value);
    }

    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value;
        }

        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return transactionDate(parsed);
        }
    }

    return fallback;
}

function sortCurrencies(currencies: readonly Currency[]): Currency[] {
    return [...currencies].sort((a, b) => a.code.localeCompare(b.code));
}

function fallbackCurrencies(
    logger?: Pick<Logger, 'warn'>,
    reason?: string,
    error?: unknown
): Currency[] {
    logger?.warn('Using bundled Frankfurter currency catalog fallback', {
        Reason: reason,
        Error:
            error instanceof Error
                ? error.message
                : error === undefined
                  ? undefined
                  : String(error)
    });
    return [...frankfurterCurrencyCatalog];
}

function normalizeCurrencies(payload: FrankfurterCurrencyResponse): Currency[] {
    if (Array.isArray(payload)) {
        return payload.flatMap(item => {
            const code = item.iso_code ?? item.code;
            const name = item.name;
            if (
                typeof code !== 'string' ||
                typeof name !== 'string' ||
                !/^[A-Z]{3}$/.test(code) ||
                name.length === 0
            ) {
                return [];
            }

            return [{ code, name }];
        });
    }

    return Object.entries(payload).flatMap(([code, name]) => {
        if (
            !/^[A-Z]{3}$/.test(code) ||
            typeof name !== 'string' ||
            name.length === 0
        ) {
            return [];
        }

        return [{ code, name }];
    });
}

export async function listCurrencies(
    config: Config,
    logger?: Pick<Logger, 'warn'>
): Promise<Currency[]> {
    try {
        const response = await fetch(
            `${config.frankfurter.baseUrl}/currencies`
        );
        if (!response.ok) {
            return fallbackCurrencies(
                logger,
                `Frankfurter returned HTTP ${response.status}`
            );
        }

        const payload = (await response.json()) as FrankfurterCurrencyResponse;
        const currencies = normalizeCurrencies(payload);
        if (currencies.length === 0) {
            return fallbackCurrencies(
                logger,
                'Frankfurter payload contained no valid currencies'
            );
        }

        return sortCurrencies(currencies);
    } catch (error) {
        return fallbackCurrencies(logger, 'Frankfurter request failed', error);
    }
}

export async function getExchangeRate(
    db: AppDb,
    config: Config,
    baseCurrency: string,
    quoteCurrency: string,
    date: string
): Promise<ExchangeRate> {
    const base = baseCurrency.trim().toUpperCase();
    const quote = quoteCurrency.trim().toUpperCase();

    if (base === quote) {
        return { rate: 1, rateDate: date };
    }

    const cached = await db.exchangeRates
        .where(rate => rate.baseCurrency, base)
        .where(rate => rate.quoteCurrency, quote)
        .where(rate => rate.rateDate, date)
        .first();

    if (cached) {
        return {
            rate: Number(cached.rate),
            rateDate: normalizeRateDate(cached.rateDate, date)
        };
    }

    const params = new URLSearchParams({ date });
    const response = await fetch(
        `${config.frankfurter.baseUrl}/rate/${base}/${quote}?${params}`
    );
    if (!response.ok) {
        throw new Error(`Could not fetch ${base}/${quote} rate.`);
    }

    const payload = (await response.json()) as FrankfurterRateResponse;
    if (typeof payload.rate !== 'number') {
        throw new Error(`Frankfurter returned no ${base}/${quote} rate.`);
    }

    const rateDate = normalizeRateDate(payload.date, date);
    await db.exchangeRates
        .onConflict(
            rate => rate.baseCurrency,
            rate => rate.quoteCurrency,
            rate => rate.rateDate
        )
        .ignore({
            baseCurrency: base,
            quoteCurrency: quote,
            rateDate,
            rate: payload.rate
        });

    return { rate: payload.rate, rateDate };
}

export async function convertCurrencyForUser(
    db: AppDb,
    config: Config,
    userId: number,
    query: CurrencyConversionQuery
): Promise<CurrencyConversion> {
    const user = (await db.users.find(userId)) as UserDb | undefined;
    if (!user) {
        throw new Error('User was not found.');
    }

    const currency = query.currency.trim().toUpperCase();
    const defaultCurrency = user.defaultCurrency.trim().toUpperCase();
    const rateDate = transactionDate(
        query.occurredAt ?? new Date(),
        user.timezone
    );
    const exchange = await getExchangeRate(
        db,
        config,
        currency,
        defaultCurrency,
        rateDate
    );

    return {
        amount: query.amount,
        currency,
        defaultCurrencyAmount: convertAmount(query.amount, exchange.rate),
        defaultCurrency,
        exchangeRate: exchange.rate,
        exchangeRateDate: exchange.rateDate
    };
}
