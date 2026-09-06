import { afterEach, describe, expect, it, vi } from 'vitest';
import { createXpenserClient, type XpenserClient } from './index';

const dates = [
    new Date('2026-01-01T12:00:00Z'),
    new Date('2026-01-02T12:00:00Z')
] as const;
type ReadCase = {
    name: string;
    read: (
        client: XpenserClient,
        query: Record<string, unknown>
    ) => Promise<unknown>;
    variants: Record<string, readonly [unknown, unknown]>;
};

const queryReads: ReadCase[] = [
    {
        name: 'budgets',
        read: (client, query) => client.budgets.list({ query: { ...query } }),
        variants: {
            status: [undefined, 'archived']
        }
    },
    {
        name: 'categories',
        read: (client, query) =>
            client.categories.list({ query: { ...query } }),
        variants: {
            activeOnly: [undefined, true],
            budgetId: [1, 2],
            sort: [undefined, 'recent-transaction-count']
        }
    },
    {
        name: 'vendors',
        read: (client, query) =>
            client.vendors.list({ query: { limit: 25, ...query } }),
        variants: {
            budgetId: [1, 2],
            limit: [1, 2],
            search: ['coffee', 'tea']
        }
    },
    {
        name: 'transaction-tags',
        read: (client, query) =>
            client.transactionTags.list({ query: { limit: 25, ...query } }),
        variants: {
            budgetId: [1, 2],
            limit: [1, 2],
            search: ['coffee', 'tea']
        }
    },
    {
        name: 'transactions',
        read: (client, query) =>
            client.transactions.list({
                query: { page: 1, limit: 50, direction: 'desc', ...query }
            }),
        variants: {
            budgetId: [1, 2],
            categoryId: [1, 2],
            parentCategoryId: [1, 2],
            vendorId: [1, 'none'],
            search: ['coffee', 'tea'],
            tagIds: ['1', '1,2'],
            untagged: [undefined, true],
            from: dates,
            to: dates,
            page: [1, 2],
            limit: [1, 2],
            direction: ['asc', 'desc'],
            type: ['expense', 'income']
        }
    },
    {
        name: 'transaction-export',
        read: (client, query) =>
            client.transactions.exportCsv({
                query: { currencies: 'USD', direction: 'desc', ...query }
            }),
        variants: {
            budgetId: [1, 2],
            categoryId: [1, 2],
            parentCategoryId: [1, 2],
            vendorId: [1, 'none'],
            search: ['coffee', 'tea'],
            tagIds: ['1', '1,2'],
            untagged: [undefined, true],
            from: dates,
            to: dates,
            direction: ['asc', 'desc'],
            type: ['expense', 'income'],
            currencies: ['USD', 'USD,EUR']
        }
    },
    {
        name: 'currency-conversion',
        read: (client, query) =>
            client.currencies.convert({
                query: { amount: 10, currency: 'USD', ...query }
            }),
        variants: {
            budgetId: [1, 2],
            amount: [10, 20],
            currency: ['USD', 'EUR'],
            occurredAt: dates
        }
    },
    {
        name: 'dashboard',
        read: (client, query) =>
            client.dashboard.summary({ query: { period: 'day', ...query } }),
        variants: {
            budgetId: [1, 2],
            currency: ['USD', 'EUR'],
            date: dates,
            vendorLimit: [1, 2],
            period: ['day', 'month']
        }
    },
    {
        name: 'dashboard-window',
        read: (client, query) =>
            client.dashboard.window({
                query: { period: 'day', before: 2, after: 2, ...query }
            }),
        variants: {
            budgetId: [1, 2],
            currency: ['USD', 'EUR'],
            date: dates,
            vendorLimit: [1, 2],
            period: ['day', 'month'],
            before: [1, 2],
            after: [1, 2]
        }
    },
    {
        name: 'stats',
        read: (client, query) =>
            client.stats.overview({
                query: { groupBy: 'day', timeframe: 'this-month', ...query }
            }),
        variants: {
            budgetId: [1, 2],
            date: dates,
            from: dates,
            to: dates,
            period: ['day', 'month'],
            groupBy: ['day', 'month'],
            timeframe: ['this-month', 'last-month']
        }
    },
    {
        name: 'stats-window',
        read: (client, query) =>
            client.stats.window({
                query: { period: 'day', before: 2, after: 2, ...query }
            }),
        variants: {
            budgetId: [1, 2],
            date: dates,
            period: ['day', 'month'],
            before: [1, 2],
            after: [1, 2]
        }
    },
    {
        name: 'stats-tags',
        read: (client, query) =>
            client.stats.tags({ query: { period: 'day', ...query } }),
        variants: {
            budgetId: [1, 2],
            date: dates,
            period: ['day', 'month'],
            tag: [1, 'untagged']
        }
    },
    {
        name: 'stats-category-trend',
        read: (client, query) =>
            client.stats.categoryTrend({
                params: { id: 1 },
                query: { range: 'last-12-months', groupBy: 'month', ...query }
            }),
        variants: {
            budgetId: [1, 2],
            from: dates,
            to: dates,
            range: ['last-12-months', 'all-time'],
            groupBy: ['day', 'month']
        }
    }
];

function harness(
    options: {
        disableBatching?: boolean;
        respond?: (url: URL, init: RequestInit) => Response;
    } = {}
) {
    let revision = 0;
    const respond =
        options.respond ??
        ((url: URL, init: RequestInit) => {
            if (init.method !== 'GET') revision++;
            return Response.json({ url: url.pathname + url.search, revision });
        });
    const transport = vi.fn<typeof fetch>(async (input, init = {}) => {
        const url = new URL(String(input));
        if (url.pathname === '/__batch') {
            const { requests } = JSON.parse(String(init.body)) as {
                requests: { url: string; method: string }[];
            };
            return Response.json({
                responses: await Promise.all(
                    requests.map(async request => {
                        const response = respond(
                            new URL(request.url, url),
                            request
                        );
                        return {
                            status: response.status,
                            headers: Object.fromEntries(response.headers),
                            body: await response.text()
                        };
                    })
                )
            });
        }
        return respond(url, init);
    });
    const invalidated = vi.fn();
    const client = createXpenserClient({
        baseUrl: 'https://api.test',
        getToken: () => 'fixed-test-user',
        fetch: transport,
        disableBatching: options.disableBatching ?? true,
        invalidateCacheTag: invalidated
    });
    return { client, transport, invalidated };
}

afterEach(() => vi.restoreAllMocks());

describe('real Xpenser client cache behavior', () => {
    for (const { name, read, variants } of queryReads) {
        describe(name, () => {
            it('reuses identical reads and returns a separately consumable response', async () => {
                const { client, transport } = harness();
                const first = await read(client, {});
                expect(await read(client, {})).toEqual(first);
                expect(transport).toHaveBeenCalledTimes(1);
            });
            it.each(
                Object.entries(variants)
            )('partitions %s variants', async (field, [first, second]) => {
                const { client, transport } = harness();
                const a = await read(client, { [field]: first });
                const b = await read(client, { [field]: second });
                expect(b).not.toEqual(a);
                expect(await read(client, { [field]: first })).toEqual(a);
                expect(await read(client, { [field]: second })).toEqual(b);
                expect(transport).toHaveBeenCalledTimes(2);
            });
        });
    }

    it.each([
        true,
        false
    ])('keeps endpoint shapes separate with disableBatching=%s', async disableBatching => {
        const { client, transport } = harness({
            disableBatching,
            respond: url => {
                const path = url.pathname.replace(/\/$/, '');
                if (path === '/api/vendors')
                    return Response.json([{ id: 1, name: 'Cafe' }]);
                if (path === '/api/vendors/1')
                    return Response.json({ id: 1, name: 'Cafe' });
                if (path === '/api/auth/me')
                    return Response.json({ email: 'test@example.com' });
                if (path === '/api/users/me/telegram')
                    return Response.json({ linked: false });
                if (path.endsWith('/export.csv'))
                    return new Response('note,amount\ncoffee,10\n', {
                        headers: { 'content-type': 'text/csv' }
                    });
                return Response.json({ url: path });
            }
        });
        const reads = [
            () => client.vendors.list({ query: { limit: 25 } }),
            () => client.vendors.get({ params: { id: 1 } }),
            () => client.auth.me(),
            () => client.users.telegramStatus(),
            () =>
                client.transactions.list({
                    query: { page: 1, limit: 50, direction: 'desc' }
                }),
            () =>
                client.transactions.exportCsv({
                    query: { currencies: 'USD', direction: 'desc' }
                }),
            () => client.dashboard.summary({ query: { period: 'day' } }),
            () =>
                client.dashboard.window({
                    query: { period: 'day', before: 2, after: 2 }
                }),
            () =>
                client.stats.overview({
                    query: { groupBy: 'day', timeframe: 'this-month' }
                }),
            () =>
                client.stats.window({
                    query: { period: 'day', before: 2, after: 2 }
                }),
            () => client.stats.tags({ query: { period: 'day' } }),
            () =>
                client.stats.categoryTrend({
                    params: { id: 1 },
                    query: { range: 'last-12-months', groupBy: 'month' }
                })
        ];
        // Cold concurrent reads exercise batching; warm reads catch cross-endpoint reuse.
        const first = await Promise.all(reads.map(read => read()));
        expect(first.slice(0, 6)).toEqual([
            [{ id: 1, name: 'Cafe' }],
            { id: 1, name: 'Cafe' },
            { email: 'test@example.com' },
            { linked: false },
            { url: '/api/transactions' },
            'note,amount\ncoffee,10\n'
        ]);
        const coldCalls = transport.mock.calls.length;
        for (const [index, read] of reads.entries())
            expect(await read()).toEqual(first[index]);
        expect(transport).toHaveBeenCalledTimes(coldCalls);
        if (!disableBatching) {
            expect(
                transport.mock.calls.some(([url]) =>
                    String(url).endsWith('/__batch')
                )
            ).toBe(true);
        }
    });

    it('distinguishes vendor and category-trend IDs', async () => {
        const { client, transport } = harness();
        for (const read of [
            (id: number) => client.vendors.get({ params: { id } }),
            (id: number) =>
                client.stats.categoryTrend({
                    params: { id },
                    query: { range: 'last-12-months', groupBy: 'month' }
                })
        ]) {
            const first = await read(1);
            expect(await read(2)).not.toEqual(first);
            expect(await read(1)).toEqual(first);
        }
        expect(transport).toHaveBeenCalledTimes(4);
    });

    it('refetches every affected response and variant after a transaction mutation', async () => {
        const { client, transport, invalidated } = harness();
        const reads = [
            ...queryReads
                .filter(
                    read =>
                        !['budgets', 'currency-conversion'].includes(read.name)
                )
                .flatMap(({ read }) => [
                    () => read(client, { budgetId: 1 }),
                    () => read(client, { budgetId: 2 })
                ]),
            () => client.vendors.get({ params: { id: 1 } }),
            () => client.auth.me(),
            () => client.users.telegramStatus()
        ];
        const first = [];
        for (const read of reads) first.push(await read());
        const coldCalls = transport.mock.calls.length;
        for (const [index, read] of reads.entries())
            expect(await read()).toEqual(first[index]);
        expect(transport).toHaveBeenCalledTimes(coldCalls);
        await client.transactions.update({
            params: { id: 1 },
            body: { note: 'updated' }
        });
        for (const [index, read] of reads.entries())
            expect(await read()).not.toEqual(first[index]);
        expect(transport).toHaveBeenCalledTimes(coldCalls * 2 + 1);
        for (const tag of [
            'user-profile',
            'telegram-status',
            'vendors',
            'vendor',
            'transactions',
            'transaction-export',
            'dashboard',
            'dashboard-window',
            'stats',
            'stats-window',
            'stats-tags',
            'stats-category-trend'
        ]) {
            expect(invalidated).toHaveBeenCalledWith(tag);
        }
    });

    it('invalidates profile and Telegram status when disconnecting', async () => {
        const { client, invalidated } = harness();
        const profile = await client.auth.me();
        const telegram = await client.users.telegramStatus();
        await client.users.disconnectTelegram();
        expect(await client.auth.me()).not.toEqual(profile);
        expect(await client.users.telegramStatus()).not.toEqual(telegram);
        expect(invalidated).toHaveBeenCalledWith('user-profile');
        expect(invalidated).toHaveBeenCalledWith('telegram-status');
    });

    it('invalidates currency conversion on preference and budget updates', async () => {
        const { client } = harness();
        const read = () =>
            client.currencies.convert({
                query: { amount: 10, currency: 'EUR', budgetId: 1 }
            });
        const initial = await read();
        await client.users.updatePreferences({
            body: {
                timezone: 'Europe/Paris',
                weeklyEmailReportEnabled: true,
                monthlyEmailReportEnabled: true
            }
        });
        const afterPreferences = await read();
        expect(afterPreferences).not.toEqual(initial);
        await client.budgets.update({
            params: { id: 1 },
            body: { defaultCurrency: 'GBP' }
        });
        expect(await read()).not.toEqual(afterPreferences);
    });

    it.each([
        [
            'vendor',
            30_000,
            (c: XpenserClient) => c.vendors.get({ params: { id: 1 } })
        ],
        [
            'telegram-status',
            30_000,
            (c: XpenserClient) => c.users.telegramStatus()
        ],
        [
            'transaction-export',
            30_000,
            (c: XpenserClient) =>
                c.transactions.exportCsv({
                    query: { currencies: 'USD', direction: 'desc' }
                })
        ],
        [
            'dashboard-window',
            60_000,
            (c: XpenserClient) =>
                c.dashboard.window({
                    query: { period: 'day', before: 2, after: 2 }
                })
        ],
        [
            'stats-window',
            5_000,
            (c: XpenserClient) =>
                c.stats.window({
                    query: { period: 'day', before: 2, after: 2 }
                })
        ],
        [
            'stats-tags',
            5_000,
            (c: XpenserClient) => c.stats.tags({ query: { period: 'day' } })
        ],
        [
            'stats-category-trend',
            5_000,
            (c: XpenserClient) =>
                c.stats.categoryTrend({
                    params: { id: 1 },
                    query: { range: 'last-12-months', groupBy: 'month' }
                })
        ]
    ] as const)('preserves the %s TTL', async (_name, ttl, read) => {
        const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
        const { client, transport } = harness();
        await read(client);
        clock.mockReturnValue(1_000_000 + ttl - 1);
        await read(client);
        expect(transport).toHaveBeenCalledTimes(1);
        clock.mockReturnValue(1_000_000 + ttl);
        await read(client);
        expect(transport).toHaveBeenCalledTimes(2);
    });

    it('does not share private responses between client instances', async () => {
        const transport = vi.fn<typeof fetch>(async (_url, init) =>
            Response.json({
                principal: new Headers(init?.headers).get('authorization')
            })
        );
        const makeClient = (token: string) =>
            createXpenserClient({
                baseUrl: 'https://api.test',
                fetch: transport,
                disableBatching: true,
                getToken: () => token
            });
        const first = makeClient('user-one');
        const second = makeClient('user-two');
        expect(await first.auth.me()).toEqual({ principal: 'Bearer user-one' });
        expect(await second.auth.me()).toEqual({
            principal: 'Bearer user-two'
        });
        await first.auth.me();
        await second.auth.me();
        expect(transport).toHaveBeenCalledTimes(2);
    });
});
