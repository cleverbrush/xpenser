import type { Logger } from '@cleverbrush/log';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../config.js';
import {
    convertAmount,
    convertCurrencyForUser,
    createCurrencyCatalogLoader,
    getExchangeRate,
    transactionDate
} from './currencies.js';
import { frankfurterCurrencyCatalog } from './frankfurter-currency-catalog.js';

const config = {
    frankfurter: {
        baseUrl: 'https://frankfurter.example.test/v2'
    }
} as Config;

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('currency calculations', () => {
    it('rounds converted amounts to cents', () => {
        expect(convertAmount(12.345, 1.2345)).toBe(15.24);
    });

    it('uses the transaction calendar date for historical rates', () => {
        expect(transactionDate(new Date('2026-05-09T18:30:00.000Z'))).toBe(
            '2026-05-09'
        );
        expect(
            transactionDate(
                new Date('2026-05-10T06:30:00.000Z'),
                'America/Los_Angeles'
            )
        ).toBe('2026-05-09');
    });
});

describe('exchange rates', () => {
    it('uses rate 1 for same-currency conversions without querying rates', async () => {
        const db = {
            exchangeRates: {
                where: vi.fn()
            }
        };

        await expect(
            getExchangeRate(db as never, config, 'usd', 'USD', '2026-05-11')
        ).resolves.toEqual({
            rate: 1,
            rateDate: '2026-05-11'
        });
        expect(db.exchangeRates.where).not.toHaveBeenCalled();
    });

    it('normalizes cached rate dates returned as Date objects', async () => {
        const db = {
            exchangeRates: {
                where: vi.fn().mockReturnThis(),
                first: vi.fn().mockResolvedValue({
                    rate: 1.2345,
                    rateDate: new Date('2026-05-11T00:00:00.000Z')
                })
            }
        };

        const exchange = await getExchangeRate(
            db as never,
            config,
            'USD',
            'EUR',
            '2026-05-11'
        );

        expect(exchange).toEqual({
            rate: 1.2345,
            rateDate: '2026-05-11'
        });
    });

    it('converts amounts to the budget default currency', async () => {
        const budgetMembers = {
            where: vi.fn(() => budgetMembers),
            first: vi.fn().mockResolvedValue({
                budgetId: 2,
                userId: 1,
                displayName: 'Travel',
                role: 'admin'
            })
        };
        const db = {
            users: {
                find: vi.fn().mockResolvedValue({
                    id: 1,
                    defaultCurrency: 'USD',
                    timezone: 'UTC'
                })
            },
            budgets: {
                find: vi.fn().mockResolvedValue({
                    id: 2,
                    defaultCurrency: 'GBP',
                    archivedAt: null
                })
            },
            budgetMembers,
            exchangeRates: {
                where: vi.fn().mockReturnThis(),
                first: vi.fn().mockResolvedValue({
                    rate: 1.5,
                    rateDate: '2026-05-11'
                })
            }
        };

        await expect(
            convertCurrencyForUser(db as never, config, 1, {
                amount: 12,
                currency: 'EUR',
                budgetId: 2,
                occurredAt: new Date('2026-05-11T12:00:00.000Z')
            })
        ).resolves.toEqual({
            amount: 12,
            currency: 'EUR',
            defaultCurrencyAmount: 18,
            defaultCurrency: 'GBP',
            exchangeRate: 1.5,
            exchangeRateDate: '2026-05-11'
        });
    });

    it('converts primary-currency amounts without querying exchange rates', async () => {
        const budgetMembers = {
            where: vi.fn(() => budgetMembers),
            first: vi.fn().mockResolvedValue({
                budgetId: 2,
                userId: 1,
                displayName: 'Travel',
                role: 'admin'
            })
        };
        const db = {
            users: {
                find: vi.fn().mockResolvedValue({
                    id: 1,
                    defaultCurrency: 'USD',
                    timezone: 'UTC'
                })
            },
            budgets: {
                find: vi.fn().mockResolvedValue({
                    id: 2,
                    defaultCurrency: 'GBP',
                    archivedAt: null
                })
            },
            budgetMembers,
            exchangeRates: {
                where: vi.fn()
            }
        };

        await expect(
            convertCurrencyForUser(db as never, config, 1, {
                amount: 12,
                currency: 'GBP',
                budgetId: 2,
                occurredAt: new Date('2026-05-11T12:00:00.000Z')
            })
        ).resolves.toEqual({
            amount: 12,
            currency: 'GBP',
            defaultCurrencyAmount: 12,
            defaultCurrency: 'GBP',
            exchangeRate: 1,
            exchangeRateDate: '2026-05-11'
        });
        expect(db.exchangeRates.where).not.toHaveBeenCalled();
    });
});

describe('currency listing', () => {
    it('returns bundled currencies immediately and refreshes from v2 array payloads', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify([
                    { iso_code: 'USD', name: 'United States Dollar' },
                    { iso_code: 'AED', name: 'United Arab Emirates Dirham' }
                ]),
                { status: 200 }
            )
        );
        const loadCurrencies = createCurrencyCatalogLoader({
            fetch: fetchMock
        });

        await expect(loadCurrencies(config)).resolves.toEqual(
            frankfurterCurrencyCatalog
        );

        await vi.waitFor(async () => {
            await expect(loadCurrencies(config)).resolves.toEqual([
                { code: 'AED', name: 'United Arab Emirates Dirham' },
                { code: 'USD', name: 'United States Dollar' }
            ]);
        });
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('supports object map payloads', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    USD: 'United States Dollar',
                    AED: 'United Arab Emirates Dirham'
                }),
                { status: 200 }
            )
        );
        const loadCurrencies = createCurrencyCatalogLoader({
            fetch: fetchMock
        });

        await loadCurrencies(config);
        await vi.waitFor(async () => {
            await expect(loadCurrencies(config)).resolves.toEqual([
                { code: 'AED', name: 'United Arab Emirates Dirham' },
                { code: 'USD', name: 'United States Dollar' }
            ]);
        });
    });

    it('keeps bundled currencies and backs off after non-ok responses', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response('upstream error', { status: 502 }));
        const logger = { warn: vi.fn() } as Pick<Logger, 'warn'>;
        const loadCurrencies = createCurrencyCatalogLoader({
            fetch: fetchMock,
            retryDelayMs: 1_000
        });

        const currencies = await loadCurrencies(config, logger);

        expect(currencies).toEqual(frankfurterCurrencyCatalog);
        await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledOnce());
        await loadCurrencies(config, logger);
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('keeps bundled currencies on thrown fetch errors', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
        const logger = { warn: vi.fn() } as Pick<Logger, 'warn'>;
        const loadCurrencies = createCurrencyCatalogLoader({
            fetch: fetchMock
        });

        const currencies = await loadCurrencies(config, logger);

        expect(currencies).toEqual(frankfurterCurrencyCatalog);
        await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledOnce());
    });

    it('keeps bundled currencies when the payload cannot be normalized', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                new Response(
                    JSON.stringify([
                        { iso_numeric: '840', name: 'United States Dollar' }
                    ]),
                    { status: 200 }
                )
            );
        const logger = { warn: vi.fn() } as Pick<Logger, 'warn'>;
        const loadCurrencies = createCurrencyCatalogLoader({
            fetch: fetchMock
        });

        const currencies = await loadCurrencies(config, logger);

        expect(currencies).toEqual(frankfurterCurrencyCatalog);
        await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledOnce());
    });

    it('deduplicates concurrent background refreshes', async () => {
        let resolveFetch: ((response: Response) => void) | undefined;
        const fetchMock = vi.fn(
            () =>
                new Promise<Response>(resolve => {
                    resolveFetch = resolve;
                })
        );
        const loadCurrencies = createCurrencyCatalogLoader({
            fetch: fetchMock
        });

        await Promise.all([
            loadCurrencies(config),
            loadCurrencies(config),
            loadCurrencies(config)
        ]);

        expect(fetchMock).toHaveBeenCalledOnce();
        resolveFetch?.(
            new Response(JSON.stringify({ USD: 'United States Dollar' }), {
                status: 200
            })
        );
        await vi.waitFor(async () => {
            await expect(loadCurrencies(config)).resolves.toEqual([
                { code: 'USD', name: 'United States Dollar' }
            ]);
        });
    });

    it('refreshes again after the successful catalog expires', async () => {
        let now = 0;
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ USD: 'US Dollar' }), {
                    status: 200
                })
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ EUR: 'Euro' }), { status: 200 })
            );
        const loadCurrencies = createCurrencyCatalogLoader({
            fetch: fetchMock,
            now: () => now,
            refreshIntervalMs: 1_000
        });

        await loadCurrencies(config);
        await vi.waitFor(async () => {
            await expect(loadCurrencies(config)).resolves.toEqual([
                { code: 'USD', name: 'US Dollar' }
            ]);
        });
        now = 999;
        await loadCurrencies(config);
        expect(fetchMock).toHaveBeenCalledOnce();

        now = 1_000;
        await expect(loadCurrencies(config)).resolves.toEqual([
            { code: 'USD', name: 'US Dollar' }
        ]);
        await vi.waitFor(async () => {
            await expect(loadCurrencies(config)).resolves.toEqual([
                { code: 'EUR', name: 'Euro' }
            ]);
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('times out a stalled refresh and keeps the bundled catalog', async () => {
        const fetchMock = vi.fn(
            (_input: string | URL | Request, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        reject(init.signal?.reason);
                    });
                })
        );
        const logger = { warn: vi.fn() } as Pick<Logger, 'warn'>;
        const loadCurrencies = createCurrencyCatalogLoader({
            fetch: fetchMock,
            timeoutMs: 1
        });

        await expect(loadCurrencies(config, logger)).resolves.toEqual(
            frankfurterCurrencyCatalog
        );
        await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledOnce());
    });
});
