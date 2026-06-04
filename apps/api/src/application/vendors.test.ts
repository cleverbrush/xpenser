import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../config.js';
import type {
    AppDb,
    CategoryDb,
    TransactionDb,
    UserDb,
    VendorDb
} from '../db/schemas.js';
import {
    createVendor,
    getVendorCandidateDetails,
    getVendorDetails,
    listVendors,
    retryVendorEnrichment,
    searchVendorCandidates,
    updateVendor,
    vendorNormalizedName
} from './vendors.js';

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

function vendor(overrides: Partial<VendorDb> = {}): VendorDb {
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
        vendorId: 1,
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
    vendors = [],
    transactions = [],
    users = [user()]
}: {
    readonly categories?: CategoryDb[];
    readonly vendors?: VendorDb[];
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
        vendors: {
            where: vi.fn(
                <TValue>(selector: (row: VendorDb) => TValue, value: TValue) =>
                    testQuery(vendors).where(selector, value)
            ),
            insert: vi.fn(async (value: Omit<VendorDb, 'id'>) => {
                const created = {
                    id: vendors.length + 1,
                    ...value,
                    createdAt: timestamp,
                    updatedAt: timestamp
                } as VendorDb;
                vendors.push(created);
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
        apiKey: 'brandfetch-key',
        clientId: 'brandfetch-client'
    },
    vendorEnrichment: {
        enabled: true,
        timeoutMs: 2000
    }
} as Config;

describe('vendor helpers', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('normalizes vendor names for user-scoped reuse', () => {
        expect(vendorNormalizedName('  Coffee   Shop  ')).toBe('coffee shop');
    });

    it('searches Brandfetch vendor candidates with the configured client ID', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve([
                    {
                        brandId: 'id_bufet',
                        name: 'Bufet',
                        domain: 'bufet.ua',
                        icon: 'https://cdn.brandfetch.io/bufet/icon.svg',
                        claimed: true
                    }
                ])
        } as Response);

        const result = await searchVendorCandidates(config, {
            query: 'Bufet',
            limit: 3
        });

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.brandfetch.io/v2/search/Bufet?c=brandfetch-client',
            expect.objectContaining({ method: 'GET' })
        );
        expect(result).toEqual([
            {
                brandfetchBrandId: 'id_bufet',
                name: 'Bufet',
                domain: 'bufet.ua',
                logoUrl: 'https://cdn.brandfetch.io/bufet/icon.svg',
                claimed: true
            }
        ]);
    });

    it('uses the user country when enriching a vendor', async () => {
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

        const result = await createVendor(testDb({ vendors: [] }), config, 1, {
            name: 'Silpo'
        });

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
            enrichmentProvider: 'brandfetch',
            enrichmentStatus: 'success',
            logoUrl: 'https://logo',
            primaryColor: '#00aa44'
        });
    });

    it('creates a vendor from a selected Brandfetch candidate without transaction enrichment', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    id: 'id_bufet',
                    name: 'Bufet',
                    domain: 'bufet.ua',
                    description: 'Local cafe.',
                    logos: [
                        {
                            type: 'icon',
                            formats: [
                                {
                                    format: 'svg',
                                    src: 'https://cdn.brandfetch.io/bufet.svg'
                                }
                            ]
                        }
                    ],
                    colors: [{ type: 'accent', hex: '#224466' }]
                })
        } as Response);

        const result = await createVendor(testDb({ vendors: [] }), config, 1, {
            name: 'Bufet',
            brandfetchBrandId: 'id_bufet',
            resolvedName: 'Bufet',
            domain: 'bufet.ua',
            logoUrl: 'https://cdn.brandfetch.io/search-icon.svg'
        });

        expect(fetchSpy).toHaveBeenCalledOnce();
        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.brandfetch.io/v2/brands/id_bufet',
            expect.objectContaining({
                headers: {
                    Authorization: 'Bearer brandfetch-key'
                },
                method: 'GET'
            })
        );
        expect(result).toMatchObject({
            resolvedName: 'Bufet',
            description: 'Local cafe.',
            domain: 'bufet.ua',
            enrichmentProvider: 'brandfetch',
            enrichmentStatus: 'success',
            logoUrl: 'https://cdn.brandfetch.io/bufet.svg',
            primaryColor: '#224466'
        });
    });

    it('gets rich Brandfetch candidate details for edit review', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    name: 'Walmart',
                    domain: 'walmart.com',
                    description: 'Retail stores.',
                    logos: [
                        {
                            type: 'icon',
                            formats: [
                                {
                                    format: 'svg',
                                    src: 'https://cdn.brandfetch.io/walmart.svg'
                                }
                            ]
                        }
                    ],
                    colors: [{ type: 'accent', hex: '#0071ce' }]
                })
        } as Response);

        const result = await getVendorCandidateDetails(config, {
            brandfetchBrandId: 'id_walmart',
            domain: 'walmart.com'
        });

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.brandfetch.io/v2/brands/id_walmart',
            expect.objectContaining({
                headers: {
                    Authorization: 'Bearer brandfetch-key'
                },
                method: 'GET'
            })
        );
        expect(result).toEqual({
            brandfetchBrandId: 'id_walmart',
            name: 'Walmart',
            domain: 'walmart.com',
            description: 'Retail stores.',
            logoUrl: 'https://cdn.brandfetch.io/walmart.svg',
            primaryColor: '#0071ce'
        });
    });

    it('updates an unresolved existing vendor from a selected Brandfetch candidate', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            status: 404
        } as Response);

        const existing = vendor({
            name: 'Bufet',
            normalizedName: 'bufet',
            enrichmentProvider: 'brandfetch',
            enrichmentStatus: 'failed',
            enrichedAt: timestamp
        });

        const result = await createVendor(
            testDb({ vendors: [existing] }),
            config,
            1,
            {
                name: 'Bufet',
                brandfetchBrandId: 'id_bufet',
                resolvedName: 'Bufet',
                domain: 'bufet.ua',
                logoUrl: 'https://cdn.brandfetch.io/search-icon.svg'
            }
        );

        expect(fetchSpy).toHaveBeenCalledOnce();
        expect(result).toMatchObject({
            id: existing.id,
            resolvedName: 'Bufet',
            domain: 'bufet.ua',
            enrichmentStatus: 'success',
            logoUrl: 'https://cdn.brandfetch.io/search-icon.svg'
        });
    });

    it('suggests the most used active category for a vendor', async () => {
        const restaurants = category({ id: 2, name: 'Restaurants' });
        const result = await listVendors(
            testDb({
                categories: [category(), restaurants],
                vendors: [vendor()],
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

    it('returns disabled enrichment status when enrichment is not configured', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');

        const result = await createVendor(
            testDb({ vendors: [] }),
            {
                ...config,
                brandfetch: { apiKey: undefined },
                vendorEnrichment: { enabled: false, timeoutMs: 2000 }
            } as Config,
            1,
            { name: 'Walmart' }
        );

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            displayName: 'Walmart',
            enrichmentStatus: 'disabled'
        });
        expect(result.enrichedAt).toBeInstanceOf(Date);
    });

    it('marks Brandfetch transaction 404 responses as not found', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            status: 404
        } as Response);

        const result = await retryVendorEnrichment(
            testDb({
                vendors: [
                    vendor({
                        name: 'Bufet',
                        normalizedName: 'bufet',
                        enrichmentStatus: 'failed',
                        enrichedAt: timestamp
                    })
                ]
            }),
            config,
            1,
            1
        );

        expect(result).toMatchObject({
            displayName: 'Bufet',
            enrichmentProvider: 'brandfetch',
            enrichmentStatus: 'not_found'
        });
    });

    it('gets vendor details with stats and enrichment metadata', async () => {
        const result = await getVendorDetails(
            testDb({
                categories: [category()],
                vendors: [
                    vendor({
                        enrichmentProvider: 'brandfetch',
                        enrichmentStatus: 'not_found',
                        enrichedAt: timestamp
                    })
                ],
                transactions: [transaction()]
            }),
            1,
            1
        );

        expect(result).toMatchObject({
            enrichmentProvider: 'brandfetch',
            enrichmentStatus: 'not_found',
            transactionCount: 1
        });
    });

    it('uses the user-entered name as the display name', async () => {
        const result = await getVendorDetails(
            testDb({
                vendors: [
                    vendor({
                        name: 'My Walmart',
                        normalizedName: 'my walmart',
                        resolvedName: 'Walmart'
                    })
                ]
            }),
            1,
            1
        );

        expect(result).toMatchObject({
            name: 'My Walmart',
            displayName: 'My Walmart',
            resolvedName: 'Walmart'
        });
    });

    it('updates editable vendor metadata', async () => {
        const result = await updateVendor(
            testDb({
                vendors: [
                    vendor({
                        resolvedName: 'Old resolved name',
                        domain: 'old.example',
                        logoUrl: 'https://old.example/logo.svg'
                    })
                ]
            }),
            1,
            1,
            {
                name: 'Walmart',
                resolvedName: 'Walmart',
                description: 'Retail stores.',
                domain: 'https://www.walmart.com/store',
                logoUrl: 'https://walmart.com/logo.svg',
                primaryColor: '#0071ce'
            }
        );

        expect(result).toMatchObject({
            name: 'Walmart',
            displayName: 'Walmart',
            resolvedName: 'Walmart',
            description: 'Retail stores.',
            domain: 'www.walmart.com',
            logoUrl: 'https://walmart.com/logo.svg',
            primaryColor: '#0071ce'
        });
    });

    it('rejects vendor rename collisions for the same user', async () => {
        await expect(
            updateVendor(
                testDb({
                    vendors: [
                        vendor({ id: 1, name: 'Target' }),
                        vendor({
                            id: 2,
                            name: 'Walmart',
                            normalizedName: 'walmart'
                        })
                    ]
                }),
                1,
                1,
                { name: 'Walmart' }
            )
        ).rejects.toThrow('A vendor with this name already exists.');
    });

    it('forces enrichment retry even inside the enrichment TTL', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    name: 'Walmart',
                    domain: 'walmart.com',
                    logos: [
                        {
                            type: 'icon',
                            formats: [
                                {
                                    format: 'svg',
                                    src: 'https://walmart.com/logo.svg'
                                }
                            ]
                        }
                    ]
                })
        } as Response);

        const result = await retryVendorEnrichment(
            testDb({
                vendors: [
                    vendor({
                        name: 'Walmart',
                        normalizedName: 'walmart',
                        enrichedAt: new Date(),
                        enrichmentStatus: 'failed'
                    })
                ]
            }),
            config,
            1,
            1
        );

        expect(fetchSpy).toHaveBeenCalledOnce();
        expect(result).toMatchObject({
            domain: 'walmart.com',
            enrichmentStatus: 'success',
            logoUrl: 'https://walmart.com/logo.svg'
        });
    });
});
