import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../config.js';
import type {
    AppDb,
    CategoryDb,
    MerchantDb,
    TransactionDb,
    UserDb
} from '../db/schemas.js';
import {
    createMerchant,
    listMerchants,
    merchantNormalizedName
} from './merchants.js';

const timestamp = new Date('2026-06-01T00:00:00.000Z');

type TestQuery<T extends object> = Promise<T[]> & {
    first: () => Promise<T | undefined>;
    update: (values: Partial<T>) => Promise<T[]>;
    where: <TValue>(
        selector: (row: T) => TValue,
        value: TValue
    ) => TestQuery<T>;
};

function testQuery<T extends object>(rows: T[]): TestQuery<T> {
    const query = Promise.resolve(rows) as TestQuery<T>;
    query.where = <TValue>(selector: (row: T) => TValue, value: TValue) =>
        testQuery(rows.filter(row => selector(row) === value));
    query.first = async () => rows[0];
    query.update = async (values: Partial<T>) => {
        for (const row of rows) {
            Object.assign(row, values);
        }
        return rows;
    };
    return query;
}

function user(overrides: Partial<UserDb> = {}): UserDb {
    return {
        id: 1,
        email: 'jane@example.com',
        emailVerified: true,
        role: 'user',
        authProvider: 'local',
        defaultCurrency: 'USD',
        countryCode: 'UA',
        timezone: 'UTC',
        weeklyEmailReportEnabled: true,
        monthlyEmailReportEnabled: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function category(overrides: Partial<CategoryDb> = {}): CategoryDb {
    return {
        id: 1,
        userId: 1,
        parentId: null,
        name: 'Groceries',
        type: 'expense',
        kind: 'normal',
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function merchant(overrides: Partial<MerchantDb> = {}): MerchantDb {
    return {
        id: 1,
        userId: 1,
        name: 'Silpo',
        normalizedName: 'silpo',
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function transaction(overrides: Partial<TransactionDb> = {}): TransactionDb {
    return {
        id: 1,
        userId: 1,
        categoryId: 1,
        merchantId: 1,
        type: 'expense',
        amount: 12,
        currency: 'USD',
        defaultCurrencyAmount: 12,
        defaultCurrency: 'USD',
        exchangeRate: 1,
        exchangeRateDate: '2026-06-01',
        occurredAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function testDb({
    categories = [],
    merchants = [],
    transactions = [],
    users = [user()]
}: {
    readonly categories?: CategoryDb[];
    readonly merchants?: MerchantDb[];
    readonly transactions?: TransactionDb[];
    readonly users?: UserDb[];
}): AppDb {
    return {
        users: {
            find: vi.fn(async (id: number) =>
                users.find(candidate => candidate.id === id)
            )
        },
        categories: {
            where: vi.fn(
                <TValue>(
                    selector: (row: CategoryDb) => TValue,
                    value: TValue
                ) => testQuery(categories).where(selector, value)
            )
        },
        merchants: {
            where: vi.fn(
                <TValue>(
                    selector: (row: MerchantDb) => TValue,
                    value: TValue
                ) => testQuery(merchants).where(selector, value)
            ),
            insert: vi.fn(async (value: Omit<MerchantDb, 'id'>) => {
                const created = {
                    id: merchants.length + 1,
                    ...value,
                    createdAt: timestamp,
                    updatedAt: timestamp
                } as MerchantDb;
                merchants.push(created);
                return created;
            })
        },
        transactions: {
            where: vi.fn(
                <TValue>(
                    selector: (row: TransactionDb) => TValue,
                    value: TValue
                ) => testQuery(transactions).where(selector, value)
            )
        }
    } as unknown as AppDb;
}

const config = {
    brandfetch: {
        apiKey: 'brandfetch-key'
    },
    merchantEnrichment: {
        enabled: true,
        timeoutMs: 2000
    }
} as Config;

describe('merchant helpers', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('normalizes merchant names for user-scoped reuse', () => {
        expect(merchantNormalizedName('  Coffee   Shop  ')).toBe('coffee shop');
    });

    it('uses the user country when enriching a merchant', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    name: 'Silpo',
                    domain: 'silpo.ua',
                    description: 'Grocery stores in Ukraine.',
                    logos: [
                        {
                            type: 'icon',
                            formats: [{ format: 'svg', src: 'https://logo' }]
                        }
                    ],
                    colors: [{ type: 'accent', hex: '#00aa44' }]
                })
        } as Response);

        const result = await createMerchant(
            testDb({ merchants: [] }),
            config,
            1,
            { name: 'Silpo' }
        );

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.brandfetch.io/v2/brands/transaction',
            expect.objectContaining({
                body: JSON.stringify({
                    transactionLabel: 'Silpo',
                    countryCode: 'UA'
                })
            })
        );
        expect(result).toMatchObject({
            displayName: 'Silpo',
            domain: 'silpo.ua',
            logoUrl: 'https://logo',
            primaryColor: '#00aa44'
        });
    });

    it('suggests the most used active category for a merchant', async () => {
        const restaurants = category({ id: 2, name: 'Restaurants' });
        const result = await listMerchants(
            testDb({
                categories: [category(), restaurants],
                merchants: [merchant()],
                transactions: [
                    transaction({ id: 1, categoryId: 2 }),
                    transaction({ id: 2, categoryId: 1 }),
                    transaction({ id: 3, categoryId: 2 })
                ]
            }),
            1
        );

        expect(result[0]).toMatchObject({
            suggestedCategoryId: 2,
            suggestedCategoryDisplayName: 'Restaurants',
            transactionCount: 3
        });
    });
});
