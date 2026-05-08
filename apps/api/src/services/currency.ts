import type { DbContext } from '@cleverbrush/orm';
import { config } from '../config.js';
import type { AppEntityMap } from '../db/schemas.js';

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

export async function fetchExchangeRates(
  base: string,
): Promise<Map<string, number>> {
  const url = `${config.frankfurter.apiUrl}/latest?from=${base}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Frankfurter API error: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as FrankfurterResponse;
  return new Map(Object.entries(data.rates));
}

export async function storeExchangeRates(
  db: DbContext<AppEntityMap>,
  base: string,
  rates: Map<string, number>,
): Promise<void> {
  for (const [target, rate] of rates) {
    const existing = await db.exchangeRates
      .where((t) => t.baseCurrency, base)
      .where((t) => t.targetCurrency, target)
      .first();

    if (existing) {
      await db.exchangeRates.update(
        { rate, updatedAt: new Date() },
        (t) => t.id === existing.id,
      );
    } else {
      await db.exchangeRates.insert({
        baseCurrency: base,
        targetCurrency: target,
        rate,
        updatedAt: new Date(),
      });
    }
  }
}

export async function convertAmount(
  db: DbContext<AppEntityMap>,
  amount: number,
  from: string,
  to: string,
): Promise<number> {
  if (from === to) return roundCurrency(amount);

  const rate = await db.exchangeRates
    .where((t) => t.baseCurrency, from)
    .where((t) => t.targetCurrency, to)
    .first();

  if (!rate) {
    const inverse = await db.exchangeRates
      .where((t) => t.baseCurrency, to)
      .where((t) => t.targetCurrency, from)
      .first();

    if (inverse) {
      return roundCurrency(amount / inverse.rate);
    }

    return roundCurrency(amount);
  }

  return roundCurrency(amount * rate.rate);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

const COMMON_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY',
  'SEK', 'NZD', 'MXN', 'SGD', 'HKD', 'NOK', 'KRW', 'TRY',
  'INR', 'RUB', 'BRL', 'ZAR', 'PLN', 'DKK', 'CZK', 'HUF',
];

export function getAvailableCurrencies(): string[] {
  return COMMON_CURRENCIES;
}
