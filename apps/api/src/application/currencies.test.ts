import type { Logger } from '@cleverbrush/log';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../config.js';
import {
    convertAmount,
    getExchangeRate,
    listCurrencies,
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
    });
});

describe('exchange rates', () => {
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
});

describe('currency listing', () => {
    it('normalizes Frankfurter v2 array payloads', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify([
                    { iso_code: 'USD', name: 'United States Dollar' },
                    { iso_code: 'AED', name: 'United Arab Emirates Dirham' }
                ]),
                { status: 200 }
            )
        );
        vi.stubGlobal('fetch', fetchMock);

        const currencies = await listCurrencies(config);

        expect(currencies).toEqual([
            { code: 'AED', name: 'United Arab Emirates Dirham' },
            { code: 'USD', name: 'United States Dollar' }
        ]);
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
        vi.stubGlobal('fetch', fetchMock);

        const currencies = await listCurrencies(config);

        expect(currencies).toEqual([
            { code: 'AED', name: 'United Arab Emirates Dirham' },
            { code: 'USD', name: 'United States Dollar' }
        ]);
    });

    it('falls back to the bundled catalog on non-ok responses', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response('upstream error', { status: 502 }));
        const logger = { warn: vi.fn() } as Pick<Logger, 'warn'>;
        vi.stubGlobal('fetch', fetchMock);

        const currencies = await listCurrencies(config, logger);

        expect(currencies).toEqual(frankfurterCurrencyCatalog);
        expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('falls back to the bundled catalog on thrown fetch errors', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
        const logger = { warn: vi.fn() } as Pick<Logger, 'warn'>;
        vi.stubGlobal('fetch', fetchMock);

        const currencies = await listCurrencies(config, logger);

        expect(currencies).toEqual(frankfurterCurrencyCatalog);
        expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('falls back when the payload cannot be normalized', async () => {
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
        vi.stubGlobal('fetch', fetchMock);

        const currencies = await listCurrencies(config, logger);

        expect(currencies).toEqual(frankfurterCurrencyCatalog);
        expect(logger.warn).toHaveBeenCalledOnce();
    });
});
