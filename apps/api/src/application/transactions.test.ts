import { describe, expect, it, vi } from 'vitest';
import type {
    AppDb,
    CategoryDb,
    TransactionDb,
    VendorDb
} from '../db/schemas.js';
import {
    categoryTrendMaxBuckets,
    compareTransactionsByOccurrenceAsc,
    compareTransactionsByOccurrenceDesc,
    dashboardStatsGroupBy,
    dashboardSummary,
    exportTransactionsCsv,
    getTransactionScanImage,
    percentChange,
    resolveCategoryTrendRange,
    resolveDashboardComparisonRange,
    resolveDashboardPeriodWindow,
    resolveDashboardRange,
    resolveStatsRanges,
    statsTagReport,
    summarizeCategoryTrendRows,
    summarizeDashboardRows,
    TransactionCategoryError,
    TransactionExportError,
    TransactionNotFoundError,
    transactionSignedDefaultAmount
} from './transactions.js';

function budgetAccessTables() {
    const timestamp = new Date('2026-06-01T12:00:00.000Z');
    const budget = {
        id: 1,
        name: 'Main',
        defaultCurrency: 'USD',
        countryCode: 'US',
        createdByUserId: 1,
        createdAt: timestamp,
        updatedAt: timestamp
    };
    const member = {
        budgetId: 1,
        userId: 1,
        displayName: 'Main',
        role: 'admin',
        canCreateTransactions: true,
        canUpdateTransactions: true,
        canDeleteTransactions: true,
        canManageCategories: true,
        canManageVendors: true,
        canManageTags: true,
        canManageMembers: true,
        createdAt: timestamp,
        updatedAt: timestamp
    };

    return {
        budgets: {
            find: vi.fn(async () => budget)
        },
        budgetMembers: {
            where: vi.fn(() => ({
                where: vi.fn(() => ({
                    first: vi.fn(async () => member)
                }))
            }))
        }
    };
}

describe('transaction domain errors', () => {
    it('has explicit errors for not-found and invalid category cases', () => {
        expect(new TransactionNotFoundError('missing')).toBeInstanceOf(Error);
        expect(new TransactionCategoryError('bad category')).toBeInstanceOf(
            Error
        );
    });
});

describe('transaction sorting', () => {
    it('sorts latest transactions by occurrence date-time descending', () => {
        const rows = [
            { id: 1, occurredAt: new Date('2026-05-10T09:00:00.000Z') },
            { id: 2, occurredAt: new Date('2026-05-10T12:00:00.000Z') },
            { id: 3, occurredAt: new Date('2026-05-09T23:00:00.000Z') },
            { id: 4, occurredAt: new Date('2026-05-10T12:00:00.000Z') }
        ];

        expect(
            rows.sort(compareTransactionsByOccurrenceDesc).map(row => row.id)
        ).toEqual([4, 2, 1, 3]);
    });

    it('sorts oldest transactions by occurrence date-time ascending', () => {
        const rows = [
            { id: 1, occurredAt: new Date('2026-05-10T09:00:00.000Z') },
            { id: 2, occurredAt: new Date('2026-05-10T12:00:00.000Z') },
            { id: 3, occurredAt: new Date('2026-05-09T23:00:00.000Z') },
            { id: 4, occurredAt: new Date('2026-05-10T12:00:00.000Z') }
        ];

        expect(
            rows.sort(compareTransactionsByOccurrenceAsc).map(row => row.id)
        ).toEqual([3, 1, 2, 4]);
    });
});

describe('transaction category signs', () => {
    it('keeps normal transactions positive for category totals', () => {
        expect(
            transactionSignedDefaultAmount({
                defaultCurrencyAmount: '12.34',
                category: { kind: 'normal' } as never
            })
        ).toBe(12.34);
    });

    it('keeps offset category amounts positive for their reporting side', () => {
        expect(
            transactionSignedDefaultAmount({
                defaultCurrencyAmount: '12.34',
                category: { kind: 'offset' } as never
            })
        ).toBe(12.34);
    });

    it('reports offset child categories on the opposite dashboard side', () => {
        const timestamp = new Date('2026-05-10T12:00:00.000Z');
        const car = {
            id: 1,
            userId: 1,
            budgetId: 1,
            name: 'Car',
            type: 'expense',
            parentId: null,
            kind: 'normal',
            createdAt: timestamp,
            updatedAt: timestamp
        } as const;
        const returns = {
            ...car,
            id: 2,
            name: 'Returns',
            parentId: car.id,
            kind: 'offset'
        } as const;
        const row = (id: number, categoryId: number, amount: string) =>
            ({
                id,
                userId: 1,
                budgetId: 1,
                categoryId,
                type: 'expense',
                amount,
                currency: 'USD',
                defaultCurrencyAmount: amount,
                defaultCurrency: 'USD',
                exchangeRate: '1',
                exchangeRateDate: '2026-05-10',
                occurredAt: timestamp,
                createdAt: timestamp,
                updatedAt: timestamp
            }) as const;
        const summary = summarizeDashboardRows(
            { defaultCurrency: 'USD', timezone: 'UTC' },
            'month',
            {
                from: new Date('2026-05-01T00:00:00.000Z'),
                to: new Date('2026-05-31T23:59:59.999Z')
            },
            [row(1, car.id, '100'), row(2, returns.id, '25')],
            [],
            new Map<number, CategoryDb>([
                [car.id, car],
                [returns.id, returns]
            ]),
            new Map<number, VendorDb>()
        );

        expect(summary.expenseTotal).toBe(100);
        expect(summary.incomeTotal).toBe(25);
        expect(
            summary.byCategory.map(category => ({
                id: category.categoryId,
                parentId: category.categoryParentId,
                type: category.type,
                total: category.total
            }))
        ).toEqual([
            { id: car.id, parentId: null, type: 'expense', total: 100 },
            { id: returns.id, parentId: car.id, type: 'income', total: 25 }
        ]);
        expect(
            summary.byParentCategory.map(category => ({
                id: category.categoryId,
                name: category.categoryName,
                type: category.type,
                total: category.total
            }))
        ).toEqual([
            { id: car.id, name: 'Car', type: 'expense', total: 100 },
            { id: car.id, name: 'Car', type: 'income', total: 25 }
        ]);
    });

    it('includes previous-period comparison totals in dashboard summaries', () => {
        const timestamp = new Date('2026-05-10T12:00:00.000Z');
        const previousTimestamp = new Date('2026-04-10T12:00:00.000Z');
        const groceries = {
            id: 1,
            userId: 1,
            budgetId: 1,
            name: 'Groceries',
            type: 'expense',
            parentId: null,
            kind: 'normal',
            createdAt: timestamp,
            updatedAt: timestamp
        } as const;
        const salary = {
            ...groceries,
            id: 2,
            name: 'Salary',
            type: 'income'
        } as const;
        const row = (
            id: number,
            categoryId: number,
            amount: string,
            occurredAt: Date
        ) =>
            ({
                id,
                userId: 1,
                budgetId: 1,
                categoryId,
                type: categoryId === salary.id ? 'income' : 'expense',
                amount,
                currency: 'USD',
                defaultCurrencyAmount: amount,
                defaultCurrency: 'USD',
                exchangeRate: '1',
                exchangeRateDate: '2026-05-10',
                occurredAt,
                createdAt: occurredAt,
                updatedAt: occurredAt
            }) as const;
        const summary = summarizeDashboardRows(
            { defaultCurrency: 'USD', timezone: 'UTC' },
            'month',
            {
                from: new Date('2026-05-01T00:00:00.000Z'),
                to: new Date('2026-05-31T23:59:59.999Z')
            },
            [
                row(1, groceries.id, '100', timestamp),
                row(2, salary.id, '300', timestamp)
            ],
            [
                row(3, groceries.id, '75', previousTimestamp),
                row(4, groceries.id, '50', previousTimestamp),
                row(5, salary.id, '250', previousTimestamp)
            ],
            new Map<number, CategoryDb>([
                [groceries.id, groceries],
                [salary.id, salary]
            ]),
            new Map<number, VendorDb>()
        );

        expect(summary.expenseTotal).toBe(100);
        expect(summary.incomeTotal).toBe(300);
        expect(summary.comparison.previousPeriod).toEqual({
            from: new Date('2026-04-01T00:00:00.000Z'),
            to: new Date('2026-04-30T23:59:59.999Z'),
            expenseTotal: 125,
            incomeTotal: 250,
            netTotal: 125
        });
    });

    it('calculates dashboard salary growth against the previous month total', () => {
        const timestamp = new Date('2026-07-10T12:00:00.000Z');
        const previousTimestamp = new Date('2026-06-10T12:00:00.000Z');
        const salary = {
            id: 1,
            userId: 1,
            budgetId: 1,
            name: 'Salary',
            type: 'income',
            parentId: null,
            kind: 'normal',
            createdAt: previousTimestamp,
            updatedAt: previousTimestamp
        } as const;
        const row = (id: number, amount: string, occurredAt: Date) =>
            ({
                id,
                userId: 1,
                budgetId: 1,
                categoryId: salary.id,
                type: 'income',
                amount,
                currency: 'USD',
                defaultCurrencyAmount: amount,
                defaultCurrency: 'USD',
                exchangeRate: '1',
                exchangeRateDate: '2026-07-10',
                occurredAt,
                createdAt: occurredAt,
                updatedAt: occurredAt
            }) as const;
        const summary = summarizeDashboardRows(
            { defaultCurrency: 'USD', timezone: 'UTC' },
            'month',
            {
                from: new Date('2026-07-01T00:00:00.000Z'),
                to: new Date('2026-07-31T23:59:59.999Z')
            },
            [row(1, '3345', timestamp)],
            [row(2, '2998', previousTimestamp)],
            new Map<number, CategoryDb>([[salary.id, salary]]),
            new Map<number, VendorDb>()
        );
        const salaryCategory = summary.byCategory.find(
            category => category.categoryId === salary.id
        );

        expect(summary.incomeTotal).toBe(3345);
        expect(summary.comparison.previousPeriod.incomeTotal).toBe(2998);
        expect(salaryCategory?.previousPeriodTotal).toBe(2998);
        expect(salaryCategory?.percentChange).toBeCloseTo(
            ((3345 - 2998) / 2998) * 100,
            3
        );
    });

    it('uses previous-only category totals when calculating parent dashboard growth', () => {
        const timestamp = new Date('2026-07-10T12:00:00.000Z');
        const previousTimestamp = new Date('2026-06-10T12:00:00.000Z');
        const salary = {
            id: 1,
            userId: 1,
            budgetId: 1,
            name: 'Salary',
            type: 'income',
            parentId: null,
            kind: 'normal',
            createdAt: previousTimestamp,
            updatedAt: previousTimestamp
        } as const;
        const salaryBase = {
            ...salary,
            id: 2,
            name: 'Base pay',
            parentId: salary.id
        } as const;
        const row = (
            id: number,
            categoryId: number,
            amount: string,
            occurredAt: Date
        ) =>
            ({
                id,
                userId: 1,
                budgetId: 1,
                categoryId,
                type: 'income',
                amount,
                currency: 'USD',
                defaultCurrencyAmount: amount,
                defaultCurrency: 'USD',
                exchangeRate: '1',
                exchangeRateDate: '2026-07-10',
                occurredAt,
                createdAt: occurredAt,
                updatedAt: occurredAt
            }) as const;
        const summary = summarizeDashboardRows(
            { defaultCurrency: 'USD', timezone: 'UTC' },
            'month',
            {
                from: new Date('2026-07-01T00:00:00.000Z'),
                to: new Date('2026-07-31T23:59:59.999Z')
            },
            [row(1, salaryBase.id, '3345', timestamp)],
            [
                row(2, salary.id, '925', previousTimestamp),
                row(3, salaryBase.id, '2073', previousTimestamp)
            ],
            new Map<number, CategoryDb>([
                [salary.id, salary],
                [salaryBase.id, salaryBase]
            ]),
            new Map<number, VendorDb>()
        );
        const salaryRollup = summary.byParentCategory.find(
            category =>
                category.categoryId === salary.id &&
                category.categoryName === 'Salary' &&
                category.type === 'income'
        );

        expect(summary.comparison.previousPeriod.incomeTotal).toBe(2998);
        expect(
            summary.byCategory.map(category => ({
                id: category.categoryId,
                previousTotal: category.previousPeriodTotal,
                total: category.total
            }))
        ).toEqual([{ id: salaryBase.id, previousTotal: 2073, total: 3345 }]);
        expect(salaryRollup).toMatchObject({
            categoryId: salary.id,
            categoryName: 'Salary',
            previousPeriodTotal: 2998,
            total: 3345,
            transactionCount: 1,
            type: 'income'
        });
        expect(salaryRollup?.percentChange).toBeCloseTo(
            ((3345 - 2998) / 2998) * 100,
            3
        );
    });

    it('converts dashboard summaries into a selected reporting currency', async () => {
        const timestamp = new Date('2026-05-10T12:00:00.000Z');
        const previousTimestamp = new Date('2026-04-10T12:00:00.000Z');
        const groceries = {
            id: 1,
            userId: 1,
            name: 'Groceries',
            type: 'expense',
            parentId: null,
            kind: 'normal',
            createdAt: timestamp,
            updatedAt: timestamp
        } as const;
        const rows = [
            {
                id: 1,
                userId: 1,
                categoryId: groceries.id,
                vendorId: null,
                type: 'expense',
                amount: '100',
                currency: 'USD',
                defaultCurrencyAmount: '100',
                defaultCurrency: 'USD',
                exchangeRate: '1',
                exchangeRateDate: '2026-05-10',
                occurredAt: timestamp,
                createdAt: timestamp,
                updatedAt: timestamp
            },
            {
                id: 2,
                userId: 1,
                categoryId: groceries.id,
                vendorId: null,
                type: 'expense',
                amount: '50',
                currency: 'USD',
                defaultCurrencyAmount: '50',
                defaultCurrency: 'USD',
                exchangeRate: '1',
                exchangeRateDate: '2026-04-10',
                occurredAt: previousTimestamp,
                createdAt: previousTimestamp,
                updatedAt: previousTimestamp
            }
        ];
        const transactionQuery = () => {
            const query = {
                where: vi.fn(() => query),
                whereBetween: vi.fn(
                    (_field: unknown, [from, to]: readonly [Date, Date]) =>
                        Promise.resolve(
                            rows.filter(
                                row =>
                                    row.occurredAt >= from &&
                                    row.occurredAt <= to
                            )
                        )
                )
            };
            return query;
        };
        const exchangeQuery = {
            where: vi.fn(() => exchangeQuery),
            first: vi.fn(async () => ({ rate: 2, rateDate: '2026-05-10' }))
        };
        const db = {
            ...budgetAccessTables(),
            users: {
                find: vi.fn(async () => ({
                    id: 1,
                    defaultCurrency: 'USD',
                    mainBudgetId: 1,
                    timezone: 'UTC'
                }))
            },
            transactions: {
                include: vi.fn(() => transactionQuery())
            },
            categories: {
                where: vi.fn(async () => [groceries])
            },
            vendors: {
                where: vi.fn(async () => [])
            },
            exchangeRates: {
                where: vi.fn(() => exchangeQuery)
            }
        };

        const summary = await dashboardSummary(
            db as never,
            {
                frankfurter: { baseUrl: 'https://frankfurter.example.test' }
            } as never,
            1,
            'month',
            timestamp,
            undefined,
            'EUR'
        );

        expect(summary.currency).toBe('EUR');
        expect(summary.expenseTotal).toBe(200);
        expect(summary.byCategory[0]?.total).toBe(200);
        expect(summary.comparison.previousPeriod.expenseTotal).toBe(100);
    });

    it('uses fresh category lookup metadata for dashboard hierarchy summaries', () => {
        const timestamp = new Date('2026-05-10T12:00:00.000Z');
        const car = {
            id: 1,
            userId: 1,
            budgetId: 1,
            name: 'Car',
            type: 'expense',
            parentId: null,
            kind: 'normal',
            createdAt: timestamp,
            updatedAt: timestamp
        } as const;
        const returns = {
            ...car,
            id: 2,
            name: 'Returns',
            parentId: car.id,
            kind: 'offset'
        } as const;
        const staleJoinedReturns = {
            ...returns,
            parentId: null,
            kind: 'normal'
        } as const;
        const row = {
            id: 1,
            userId: 1,
            budgetId: 1,
            categoryId: returns.id,
            category: staleJoinedReturns,
            type: 'expense',
            amount: '25',
            currency: 'USD',
            defaultCurrencyAmount: '25',
            defaultCurrency: 'USD',
            exchangeRate: '1',
            exchangeRateDate: '2026-05-10',
            occurredAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp
        } as const;
        const summary = summarizeDashboardRows(
            { defaultCurrency: 'USD', timezone: 'UTC' },
            'year',
            {
                from: new Date('2026-01-01T00:00:00.000Z'),
                to: new Date('2026-12-31T23:59:59.999Z')
            },
            [row],
            [],
            new Map<number, CategoryDb>([
                [car.id, car],
                [returns.id, returns]
            ]),
            new Map<number, VendorDb>()
        );

        expect(summary.expenseTotal).toBe(0);
        expect(summary.incomeTotal).toBe(25);
        expect(
            summary.byCategory.map(category => ({
                id: category.categoryId,
                name: category.categoryName,
                parentId: category.categoryParentId,
                type: category.type,
                total: category.total
            }))
        ).toEqual([
            {
                id: returns.id,
                name: 'Returns',
                parentId: car.id,
                type: 'income',
                total: 25
            }
        ]);
        expect(
            summary.byParentCategory.map(category => ({
                id: category.categoryId,
                name: category.categoryName,
                type: category.type,
                total: category.total
            }))
        ).toEqual([{ id: car.id, name: 'Car', type: 'income', total: 25 }]);
    });

    it('summarizes vendor transaction groups for dashboard previews', () => {
        const timestamp = new Date('2026-05-10T12:00:00.000Z');
        const groceries = {
            id: 1,
            userId: 1,
            budgetId: 1,
            name: 'Groceries',
            type: 'expense',
            parentId: null,
            kind: 'normal',
            createdAt: timestamp,
            updatedAt: timestamp
        } as const;
        const salary = {
            ...groceries,
            id: 2,
            name: 'Salary',
            type: 'income'
        } as const;
        const vendor = (
            id: number,
            name: string,
            overrides: Partial<VendorDb> = {}
        ) =>
            ({
                id,
                userId: 1,
                budgetId: 1,
                name,
                normalizedName: name.toLowerCase(),
                createdAt: timestamp,
                updatedAt: timestamp,
                ...overrides
            }) as VendorDb;
        const transaction = (
            id: number,
            categoryId: number,
            amount: string,
            vendorId?: number
        ) =>
            ({
                id,
                userId: 1,
                budgetId: 1,
                categoryId,
                vendorId,
                type: categoryId === salary.id ? 'income' : 'expense',
                amount,
                currency: 'USD',
                defaultCurrencyAmount: amount,
                defaultCurrency: 'USD',
                exchangeRate: '1',
                exchangeRateDate: '2026-05-10',
                occurredAt: timestamp,
                createdAt: timestamp,
                updatedAt: timestamp
            }) as const;
        const vendors = new Map<number, VendorDb>([
            [
                1,
                vendor(1, 'Big Store', {
                    resolvedName: 'Big Store',
                    domain: 'big.example',
                    logoUrl: 'https://big.example/logo.svg',
                    primaryColor: '#0066cc'
                })
            ],
            [2, vendor(2, 'Corner Shop')],
            [3, vendor(3, 'Paycheck Inc')]
        ]);
        const extraVendors = Array.from({ length: 25 }, (_, index) => {
            const id = index + 10;
            return [id, vendor(id, `Vendor ${id}`)] as const;
        });
        const range = {
            from: new Date('2026-05-01T00:00:00.000Z'),
            to: new Date('2026-05-31T23:59:59.999Z')
        };
        const rows = [
            transaction(1, groceries.id, '20', 1),
            transaction(2, groceries.id, '30', 1),
            transaction(3, groceries.id, '100', 2),
            transaction(4, salary.id, '500', 3),
            transaction(5, groceries.id, '10'),
            transaction(6, salary.id, '25'),
            ...extraVendors.map(([id]) =>
                transaction(id, groceries.id, '1', id)
            )
        ];
        const categoriesById = new Map<number, CategoryDb>([
            [groceries.id, groceries],
            [salary.id, salary]
        ]);
        const vendorsById = new Map<number, VendorDb>([
            ...vendors,
            ...extraVendors
        ]);
        const summary = summarizeDashboardRows(
            { defaultCurrency: 'USD', timezone: 'UTC' },
            'month',
            range,
            rows,
            [],
            categoriesById,
            vendorsById
        );
        const emptyVendorSummary = summarizeDashboardRows(
            { defaultCurrency: 'USD', timezone: 'UTC' },
            'month',
            range,
            rows,
            [],
            categoriesById,
            vendorsById,
            0
        );
        const expandedVendorSummary = summarizeDashboardRows(
            { defaultCurrency: 'USD', timezone: 'UTC' },
            'month',
            range,
            rows,
            [],
            categoriesById,
            vendorsById,
            100
        );

        expect(summary.vendorCount).toBe(30);
        expect(summary.topVendors).toHaveLength(24);
        expect(emptyVendorSummary.vendorCount).toBe(30);
        expect(emptyVendorSummary.topVendors).toEqual([]);
        expect(emptyVendorSummary.categoryVendorBreakdown).toHaveLength(30);
        expect(expandedVendorSummary.topVendors).toHaveLength(30);
        expect(summary.topVendors.slice(0, 3)).toEqual([
            {
                vendorId: 1,
                vendorName: 'Big Store',
                vendorDomain: 'big.example',
                vendorLogoUrl: 'https://big.example/logo.svg',
                vendorPrimaryColor: '#0066cc',
                type: 'expense',
                total: 50,
                transactionCount: 2,
                trend: [0, 50, 0, 0, 0]
            },
            {
                vendorId: 2,
                vendorName: 'Corner Shop',
                vendorDomain: undefined,
                vendorLogoUrl: undefined,
                vendorPrimaryColor: undefined,
                type: 'expense',
                total: 100,
                transactionCount: 1,
                trend: [0, 100, 0, 0, 0]
            },
            {
                vendorId: null,
                vendorName: 'No vendor',
                vendorDomain: undefined,
                vendorLogoUrl: undefined,
                vendorPrimaryColor: undefined,
                type: 'expense',
                total: 10,
                transactionCount: 1,
                trend: [0, 10, 0, 0, 0]
            }
        ]);
        expect(expandedVendorSummary.topVendors).toContainEqual({
            vendorId: 3,
            vendorName: 'Paycheck Inc',
            vendorDomain: undefined,
            vendorLogoUrl: undefined,
            vendorPrimaryColor: undefined,
            type: 'income',
            total: 500,
            transactionCount: 1,
            trend: [0, 500, 0, 0, 0]
        });
        expect(expandedVendorSummary.topVendors).toContainEqual({
            vendorId: null,
            vendorName: 'No vendor',
            vendorDomain: undefined,
            vendorLogoUrl: undefined,
            vendorPrimaryColor: undefined,
            type: 'income',
            total: 25,
            transactionCount: 1,
            trend: [0, 25, 0, 0, 0]
        });
        expect(summary.topVendors.slice(3, 4)).toEqual([
            {
                vendorId: 10,
                vendorName: 'Vendor 10',
                vendorDomain: undefined,
                vendorLogoUrl: undefined,
                vendorPrimaryColor: undefined,
                type: 'expense',
                total: 1,
                transactionCount: 1,
                trend: [0, 1, 0, 0, 0]
            }
        ]);
        expect(
            emptyVendorSummary.categoryVendorBreakdown
                .slice(0, 3)
                .map(item => ({
                    categoryId: item.categoryId,
                    categoryName: item.categoryName,
                    vendorId: item.vendorId,
                    vendorName: item.vendorName,
                    total: item.total,
                    transactionCount: item.transactionCount,
                    trend: item.trend
                }))
        ).toEqual([
            {
                categoryId: groceries.id,
                categoryName: 'Groceries',
                vendorId: 2,
                vendorName: 'Corner Shop',
                total: 100,
                transactionCount: 1,
                trend: [0, 100, 0, 0, 0]
            },
            {
                categoryId: groceries.id,
                categoryName: 'Groceries',
                vendorId: 1,
                vendorName: 'Big Store',
                total: 50,
                transactionCount: 2,
                trend: [0, 50, 0, 0, 0]
            },
            {
                categoryId: groceries.id,
                categoryName: 'Groceries',
                vendorId: null,
                vendorName: 'No vendor',
                total: 10,
                transactionCount: 1,
                trend: [0, 10, 0, 0, 0]
            }
        ]);
        expect(expandedVendorSummary.categoryVendorBreakdown).toContainEqual({
            categoryId: salary.id,
            categoryName: 'Salary',
            categoryDisplayName: 'Salary',
            categoryParentId: null,
            categoryParentName: undefined,
            categoryKind: 'normal',
            vendorId: null,
            vendorName: 'No vendor',
            vendorDomain: undefined,
            vendorLogoUrl: undefined,
            vendorPrimaryColor: undefined,
            type: 'income',
            total: 25,
            transactionCount: 1,
            trend: [0, 25, 0, 0, 0]
        });
        expect(
            expandedVendorSummary.topVendors
                .filter(vendor => vendor.type === 'expense')
                .reduce((sum, vendor) => sum + vendor.total, 0)
        ).toBe(expandedVendorSummary.expenseTotal);
        expect(
            expandedVendorSummary.topVendors
                .filter(vendor => vendor.type === 'income')
                .reduce((sum, vendor) => sum + vendor.total, 0)
        ).toBe(expandedVendorSummary.incomeTotal);
        expect(summary.topVendors.some(item => item.type === 'income')).toBe(
            false
        );
    });
});

describe('transaction scan images', () => {
    function scanImageBudgetDb(): AppDb {
        return budgetAccessTables() as unknown as AppDb;
    }

    it('returns the latest confirmed scan image for a transaction', async () => {
        const scanTimestamp = new Date('2026-06-01T12:00:00.000Z');
        const row = {
            scanId: 10,
            scanItemId: 20,
            budgetId: 1,
            fileName: 'receipt.png',
            mimeType: 'image/png',
            sizeBytes: '5',
            createdAt: scanTimestamp,
            imageBase64: Buffer.from('image').toString('base64')
        };
        const query = {
            join: vi.fn(() => query),
            where: vi.fn(() => query),
            orderBy: vi.fn(() => query),
            select: vi.fn(() => query),
            first: vi.fn(async () => row)
        };
        const knex = vi.fn(() => query);

        await expect(
            getTransactionScanImage(scanImageBudgetDb(), knex as never, 1, 42)
        ).resolves.toEqual({
            scanId: 10,
            scanItemId: 20,
            fileName: 'receipt.png',
            mimeType: 'image/png',
            sizeBytes: 5,
            createdAt: scanTimestamp,
            imageBase64: Buffer.from('image').toString('base64')
        });
        expect(knex).toHaveBeenCalledWith('transaction_scan_items as item');
        expect(query.where).toHaveBeenCalledWith('item.transaction_id', 42);
        expect(query.where).toHaveBeenCalledWith('item.decision', 'confirmed');
    });

    it('throws when a transaction has no stored scan image', async () => {
        const query = {
            join: vi.fn(() => query),
            where: vi.fn(() => query),
            orderBy: vi.fn(() => query),
            select: vi.fn(() => query),
            first: vi.fn(async () => undefined)
        };

        await expect(
            getTransactionScanImage(
                scanImageBudgetDb(),
                vi.fn(() => query) as never,
                1,
                42
            )
        ).rejects.toBeInstanceOf(TransactionNotFoundError);
    });
});

describe('transaction CSV export', () => {
    const timestamp = new Date('2026-05-10T12:00:00.000Z');
    const category = {
        id: 1,
        userId: 1,
        budgetId: 1,
        name: 'Meals',
        type: 'expense',
        parentId: null,
        kind: 'normal',
        createdAt: timestamp,
        updatedAt: timestamp
    } as const satisfies CategoryDb;
    const vendor = {
        id: 3,
        userId: 1,
        budgetId: 1,
        name: 'Cafe',
        normalizedName: 'cafe',
        domain: null,
        logoUrl: null,
        primaryColor: null,
        createdAt: timestamp,
        updatedAt: timestamp
    } as const satisfies VendorDb;
    const tags = [
        {
            id: 10,
            userId: 1,
            name: 'Food',
            createdAt: timestamp,
            updatedAt: timestamp
        },
        {
            id: 11,
            userId: 1,
            name: 'Travel',
            createdAt: timestamp,
            updatedAt: timestamp
        }
    ] as const;
    const tagLinks = [
        { transactionId: 1, tagId: 10 },
        { transactionId: 1, tagId: 11 }
    ] as const;
    const transaction = {
        id: 1,
        userId: 1,
        budgetId: 1,
        categoryId: category.id,
        vendorId: vendor.id,
        type: 'expense',
        amount: '10',
        currency: 'USD',
        defaultCurrencyAmount: '10',
        defaultCurrency: 'USD',
        exchangeRate: '1',
        exchangeRateDate: '2026-05-10',
        occurredAt: timestamp,
        note: 'Dinner, friend',
        createdAt: timestamp,
        updatedAt: timestamp
    } as const satisfies TransactionDb;

    function exportDb(): AppDb {
        let orderCalls = 0;
        const transactionQuery = {
            where: vi.fn(
                (
                    _field: unknown,
                    operatorOrValue: unknown,
                    value?: unknown
                ) => {
                    void operatorOrValue;
                    void value;
                    return transactionQuery;
                }
            ),
            orderBy: vi.fn(() => {
                orderCalls += 1;
                return orderCalls === 2
                    ? Promise.resolve([transaction])
                    : transactionQuery;
            })
        };
        const exchangeQuery = {
            where: vi.fn(() => exchangeQuery),
            first: vi.fn(async () => ({
                baseCurrency: 'USD',
                quoteCurrency: 'EUR',
                rateDate: '2026-05-10',
                rate: '2'
            }))
        };

        return {
            ...budgetAccessTables(),
            users: {
                find: vi.fn(async () => ({
                    id: 1,
                    defaultCurrency: 'USD',
                    mainBudgetId: 1,
                    timezone: 'UTC'
                }))
            },
            budgetFavoriteCurrencies: {
                where: vi.fn(async () => [{ budgetId: 1, currency: 'EUR' }])
            },
            transactions: {
                include: vi.fn(() => transactionQuery)
            },
            categories: {
                where: vi.fn(async () => [category])
            },
            vendors: {
                where: vi.fn(async () => [vendor])
            },
            exchangeRates: {
                where: vi.fn(() => exchangeQuery)
            }
        } as unknown as AppDb;
    }

    function exportKnex() {
        return vi.fn((table: string) => {
            if (table === 'transaction_tag_links as link') {
                const query = {
                    transactionIds: [] as number[],
                    join: () => query,
                    where: () => query,
                    whereIn: (_field: string, ids: readonly number[]) => {
                        query.transactionIds = [...ids];
                        return query;
                    },
                    orderBy: () => query,
                    select: () =>
                        Promise.resolve(
                            tagLinks
                                .filter(link =>
                                    query.transactionIds.includes(
                                        link.transactionId
                                    )
                                )
                                .flatMap(link => {
                                    const tag = tags.find(
                                        candidate => candidate.id === link.tagId
                                    );
                                    return tag
                                        ? [
                                              {
                                                  transactionId:
                                                      link.transactionId,
                                                  id: tag.id,
                                                  name: tag.name,
                                                  createdAt: tag.createdAt,
                                                  updatedAt: tag.updatedAt
                                              }
                                          ]
                                        : [];
                                })
                        )
                };
                return query;
            }
            if (table === 'transaction_tag_links') {
                const query = {
                    tagIds: [] as number[],
                    whereIn: (_field: string, ids: readonly number[]) => {
                        query.tagIds = [...ids];
                        return query;
                    },
                    groupBy: () => query,
                    select: () => query,
                    count: () =>
                        Promise.resolve(
                            query.tagIds.map(tagId => ({
                                tagId,
                                transactionCount: tagLinks.filter(
                                    link => link.tagId === tagId
                                ).length
                            }))
                        )
                };
                return query;
            }
            if (table === 'transaction_scan_items as item') {
                const query = {
                    join: () => query,
                    where: () => query,
                    whereIn: () => query,
                    orderBy: () => query,
                    select: () =>
                        Promise.resolve([
                            {
                                transactionId: transaction.id,
                                scanId: 50,
                                scanItemId: 60,
                                fileName: 'receipt.png',
                                mimeType: 'image/png',
                                sizeBytes: '2048',
                                createdAt: timestamp
                            }
                        ])
                };
                return query;
            }
            if (table === 'users') {
                const query = {
                    ids: [] as number[],
                    whereIn: (_field: string, ids: readonly number[]) => {
                        query.ids = [...ids];
                        return query;
                    },
                    select: () =>
                        Promise.resolve(
                            query.ids.map(id => ({
                                id,
                                email: 'owner@example.com'
                            }))
                        )
                };
                return query;
            }
            throw new Error(`Unexpected table ${table}`);
        });
    }

    it('exports filtered transaction rows with selected currency columns', async () => {
        const exported = await exportTransactionsCsv(
            exportDb(),
            {
                frankfurter: { baseUrl: 'https://frankfurter.example.test' }
            } as never,
            1,
            {
                currencies: 'USD,EUR',
                direction: 'desc',
                from: new Date('2026-05-01T00:00:00.000Z'),
                to: new Date('2026-05-31T23:59:59.999Z')
            },
            exportKnex() as never
        );

        expect(exported.fileName).toMatch(
            /^xpenser-transactions-\d{4}-\d{2}-\d{2}\.csv$/
        );
        expect(exported.csv.split('\n')[0]).toContain('amount_USD,amount_EUR');
        expect(exported.csv).toContain('"Dinner, friend"');
        expect(exported.csv).toContain(',10,-10,USD,-10,USD,1,2026-05-10,');
        expect(exported.csv).toContain(',50,60,receipt.png,image/png,2048,');
        expect(exported.csv).toContain(',10; 11,Food; Travel,');
        expect(exported.csv.trimEnd()).toMatch(/,-10,-20$/);
    });

    it('rejects currencies outside the default and favorite set', async () => {
        await expect(
            exportTransactionsCsv(
                exportDb(),
                {
                    frankfurter: { baseUrl: 'https://frankfurter.example.test' }
                } as never,
                1,
                { currencies: 'JPY', direction: 'desc' },
                exportKnex() as never
            )
        ).rejects.toBeInstanceOf(TransactionExportError);
    });
});

describe('stats range resolution', () => {
    it('compares an in-progress month with the same elapsed previous month', () => {
        const now = new Date(2026, 4, 10, 12, 34, 0, 0);
        const ranges = resolveStatsRanges(
            { timeframe: 'this-month', groupBy: 'day' },
            now
        );

        expect(ranges.selected.from).toEqual(new Date(2026, 4, 1, 0, 0, 0, 0));
        expect(ranges.selected.to).toEqual(now);
        expect(ranges.previousPeriod.from).toEqual(
            new Date(2026, 3, 1, 0, 0, 0, 0)
        );
        expect(ranges.previousPeriod.to).toEqual(
            new Date(2026, 3, 10, 12, 34, 0, 0)
        );
        expect(ranges.previousYear.from).toEqual(
            new Date(2025, 4, 1, 0, 0, 0, 0)
        );
        expect(ranges.previousYear.to).toEqual(
            new Date(2025, 4, 10, 12, 34, 0, 0)
        );
    });

    it('compares last month with the full month before it', () => {
        const ranges = resolveStatsRanges(
            { timeframe: 'last-month', groupBy: 'day' },
            new Date(2026, 4, 10, 12, 34, 0, 0)
        );

        expect(ranges.selected.from).toEqual(new Date(2026, 3, 1, 0, 0, 0, 0));
        expect(ranges.selected.to).toEqual(
            new Date(2026, 3, 30, 23, 59, 59, 999)
        );
        expect(ranges.previousPeriod.from).toEqual(
            new Date(2026, 2, 1, 0, 0, 0, 0)
        );
        expect(ranges.previousPeriod.to).toEqual(
            new Date(2026, 2, 31, 23, 59, 59, 999)
        );
    });

    it('compares rolling presets with the same shifted window', () => {
        const ranges = resolveStatsRanges(
            { timeframe: 'last-7-days', groupBy: 'day' },
            new Date(2026, 4, 10, 12, 34, 0, 0)
        );

        expect(ranges.selected.from).toEqual(new Date(2026, 4, 4, 0, 0, 0, 0));
        expect(ranges.selected.to).toEqual(new Date(2026, 4, 10, 12, 34, 0, 0));
        expect(ranges.previousPeriod.from).toEqual(
            new Date(2026, 3, 27, 0, 0, 0, 0)
        );
        expect(ranges.previousPeriod.to).toEqual(
            new Date(2026, 4, 3, 12, 34, 0, 0)
        );
    });

    it('uses dashboard-style periods when stats period controls are supplied', () => {
        const ranges = resolveStatsRanges(
            {
                groupBy: 'week',
                period: 'month',
                date: new Date(2026, 4, 10, 12, 34, 0, 0)
            },
            new Date(2026, 4, 10, 12, 34, 0, 0)
        );

        expect(ranges.selected.from).toEqual(new Date(2026, 4, 1, 0, 0, 0, 0));
        expect(ranges.selected.to).toEqual(new Date(2026, 4, 10, 12, 34, 0, 0));
        expect(ranges.previousPeriod.from).toEqual(
            new Date(2026, 3, 1, 0, 0, 0, 0)
        );
        expect(ranges.previousPeriod.to).toEqual(
            new Date(2026, 3, 30, 23, 59, 59, 999)
        );
    });
});

describe('category trend ranges and summaries', () => {
    const category = {
        id: 7,
        userId: 1,
        budgetId: 1,
        name: 'Groceries',
        type: 'expense',
        parentId: null,
        kind: 'normal',
        createdAt: new Date('2024-01-15T12:00:00.000Z'),
        updatedAt: new Date('2024-01-15T12:00:00.000Z')
    } as const;

    function transaction(overrides: {
        readonly id: number;
        readonly amount: string;
        readonly categoryId?: number;
        readonly occurredAt: Date;
    }) {
        return {
            id: overrides.id,
            userId: 1,
            budgetId: 1,
            categoryId: overrides.categoryId ?? category.id,
            type: 'expense',
            amount: overrides.amount,
            currency: 'USD',
            defaultCurrencyAmount: overrides.amount,
            defaultCurrency: 'USD',
            exchangeRate: '1',
            exchangeRateDate: '2026-05-01',
            occurredAt: overrides.occurredAt,
            createdAt: overrides.occurredAt,
            updatedAt: overrides.occurredAt
        } as const;
    }

    it('defaults category trends to the last twelve calendar months', () => {
        const now = new Date('2026-05-30T12:00:00.000Z');

        expect(
            resolveCategoryTrendRange(
                { range: 'last-12-months' },
                { categoryCreatedAt: category.createdAt, now }
            )
        ).toEqual({
            from: new Date('2025-06-01T00:00:00.000Z'),
            to: now
        });
    });

    it('normalizes reversed custom category trend ranges', () => {
        expect(
            resolveCategoryTrendRange(
                {
                    range: 'custom',
                    from: new Date('2026-05-20T12:00:00.000Z'),
                    to: new Date('2026-05-10T12:00:00.000Z')
                },
                {
                    categoryCreatedAt: category.createdAt,
                    now: new Date('2026-05-30T12:00:00.000Z')
                }
            )
        ).toEqual({
            from: new Date('2026-05-10T00:00:00.000Z'),
            to: new Date('2026-05-20T23:59:59.999Z')
        });
    });

    it('uses the first category transaction for all-time trends', () => {
        const rows = [
            transaction({
                id: 2,
                amount: '12',
                occurredAt: new Date('2026-03-10T12:00:00.000Z')
            }),
            transaction({
                id: 1,
                amount: '12',
                occurredAt: new Date('2025-02-10T12:00:00.000Z')
            })
        ];
        const now = new Date('2026-05-30T12:00:00.000Z');

        expect(
            resolveCategoryTrendRange(
                { range: 'all-time' },
                { categoryCreatedAt: category.createdAt, now, rows }
            )
        ).toEqual({
            from: new Date('2025-02-10T00:00:00.000Z'),
            to: now
        });
    });

    it('summarizes category trend buckets for offset categories', () => {
        const offsetCategory = {
            ...category,
            id: 8,
            name: 'Returns',
            parentId: category.id,
            kind: 'offset'
        } as const;
        const range = {
            from: new Date('2026-05-01T00:00:00.000Z'),
            to: new Date('2026-05-31T23:59:59.999Z')
        };
        const response = summarizeCategoryTrendRows({
            category: offsetCategory,
            categoriesById: new Map<number, CategoryDb>([
                [category.id, category],
                [offsetCategory.id, offsetCategory]
            ]),
            currency: 'USD',
            groupBy: 'month',
            range,
            rows: [
                transaction({
                    id: 1,
                    amount: '12.34',
                    categoryId: offsetCategory.id,
                    occurredAt: new Date('2026-05-10T12:00:00.000Z')
                }),
                transaction({
                    id: 2,
                    amount: '2.34',
                    categoryId: offsetCategory.id,
                    occurredAt: new Date('2026-05-11T12:00:00.000Z')
                })
            ],
            timeFrame: 'custom'
        });

        expect(response.categoryDisplayName).toBe('Groceries -> Returns');
        expect(response.categoryKind).toBe('offset');
        expect(response.type).toBe('income');
        expect(response.total).toBe(14.68);
        expect(response.transactionCount).toBe(2);
        expect(response.densityExceeded).toBe(false);
        expect(response.trend).toHaveLength(1);
        expect(response.trend[0]?.total).toBe(14.68);
        expect(response.trend[0]?.transactionCount).toBe(2);
    });

    it('omits chart points when category trend buckets exceed the cap', () => {
        const response = summarizeCategoryTrendRows({
            category,
            currency: 'USD',
            groupBy: 'day',
            range: {
                from: new Date('2025-01-01T00:00:00.000Z'),
                to: new Date('2026-06-01T00:00:00.000Z')
            },
            rows: [],
            timeFrame: 'custom'
        });

        expect(response.bucketCount).toBeGreaterThan(categoryTrendMaxBuckets);
        expect(response.densityExceeded).toBe(true);
        expect(response.trend).toEqual([]);
    });
});

describe('dashboard range resolution', () => {
    it('defaults a day range to the current day up to now', () => {
        const now = new Date(2026, 4, 10, 12, 34, 0, 0);
        const range = resolveDashboardRange('day', now, now);

        expect(range.from).toEqual(new Date(2026, 4, 10, 0, 0, 0, 0));
        expect(range.to).toEqual(now);
    });

    it('resolves a selected day to the full calendar day', () => {
        const range = resolveDashboardRange(
            'day',
            new Date(2026, 4, 5, 8, 0, 0, 0),
            new Date(2026, 4, 10, 12, 34, 0, 0)
        );

        expect(range.from).toEqual(new Date(2026, 4, 5, 0, 0, 0, 0));
        expect(range.to).toEqual(new Date(2026, 4, 5, 23, 59, 59, 999));
    });

    it('resolves calendar days in the user timezone', () => {
        const range = resolveDashboardRange(
            'day',
            new Date('2026-05-10T12:00:00.000Z'),
            new Date('2026-05-12T12:00:00.000Z'),
            'America/Los_Angeles'
        );

        expect(range.from).toEqual(new Date('2026-05-10T07:00:00.000Z'));
        expect(range.to).toEqual(new Date('2026-05-11T06:59:59.999Z'));
    });

    it('uses Monday through Sunday for selected weeks', () => {
        const range = resolveDashboardRange(
            'week',
            new Date(2026, 4, 13, 8, 0, 0, 0),
            new Date(2026, 4, 20, 12, 34, 0, 0)
        );

        expect(range.from).toEqual(new Date(2026, 4, 11, 0, 0, 0, 0));
        expect(range.to).toEqual(new Date(2026, 4, 17, 23, 59, 59, 999));
    });

    it('resolves full month, quarter, and year periods from an anchor date', () => {
        const now = new Date(2026, 7, 20, 12, 34, 0, 0);

        expect(
            resolveDashboardRange('month', new Date(2026, 4, 13), now)
        ).toEqual({
            from: new Date(2026, 4, 1, 0, 0, 0, 0),
            to: new Date(2026, 4, 31, 23, 59, 59, 999)
        });
        expect(
            resolveDashboardRange('quarter', new Date(2026, 4, 13), now)
        ).toEqual({
            from: new Date(2026, 3, 1, 0, 0, 0, 0),
            to: new Date(2026, 5, 30, 23, 59, 59, 999)
        });
        expect(
            resolveDashboardRange('year', new Date(2025, 4, 13), now)
        ).toEqual({
            from: new Date(2025, 0, 1, 0, 0, 0, 0),
            to: new Date(2025, 11, 31, 23, 59, 59, 999)
        });
    });

    it('resolves previous full calendar quarters for dashboard comparisons', () => {
        const range = resolveDashboardRange(
            'quarter',
            new Date(2026, 4, 13),
            new Date(2026, 7, 20, 12, 34, 0, 0)
        );

        expect(resolveDashboardComparisonRange('quarter', range)).toEqual({
            from: new Date(2026, 0, 1, 0, 0, 0, 0),
            to: new Date(2026, 2, 31, 23, 59, 59, 999)
        });
    });

    it('uses the previous full calendar month for in-progress month comparisons', () => {
        const range = resolveDashboardRange(
            'month',
            new Date(2026, 4, 10, 12, 34, 0, 0),
            new Date(2026, 4, 10, 12, 34, 0, 0)
        );

        expect(resolveDashboardComparisonRange('month', range)).toEqual({
            from: new Date(2026, 3, 1, 0, 0, 0, 0),
            to: new Date(2026, 3, 30, 23, 59, 59, 999)
        });
    });

    it('resolves balanced dashboard period windows without future periods', () => {
        const dates = resolveDashboardPeriodWindow(
            'month',
            new Date('2026-03-15T12:00:00.000Z'),
            new Date('2026-05-10T12:00:00.000Z'),
            'UTC'
        );

        expect(dates.map(date => date.toISOString().slice(0, 10))).toEqual([
            '2026-01-01',
            '2026-02-01',
            '2026-03-01',
            '2026-04-01',
            '2026-05-01'
        ]);
    });

    it('clamps dashboard period window side sizes', () => {
        const dates = resolveDashboardPeriodWindow(
            'day',
            new Date('2026-05-06T12:00:00.000Z'),
            new Date('2026-05-10T12:00:00.000Z'),
            'UTC',
            99,
            99
        );

        expect(dates.map(date => date.toISOString().slice(0, 10))).toEqual([
            '2026-05-02',
            '2026-05-03',
            '2026-05-04',
            '2026-05-05',
            '2026-05-06',
            '2026-05-07',
            '2026-05-08',
            '2026-05-09',
            '2026-05-10'
        ]);
    });

    it('uses dashboard period groupings for stats windows', () => {
        expect(dashboardStatsGroupBy('day')).toBe('hour');
        expect(dashboardStatsGroupBy('week')).toBe('day');
        expect(dashboardStatsGroupBy('month')).toBe('week');
        expect(dashboardStatsGroupBy('quarter')).toBe('week');
        expect(dashboardStatsGroupBy('year')).toBe('month');
    });
});

describe('stats tag reports', () => {
    const timestamp = new Date('2026-05-10T12:00:00.000Z');
    const categories = [
        {
            id: 1,
            userId: 1,
            budgetId: 1,
            name: 'Groceries',
            type: 'expense',
            parentId: null,
            kind: 'normal',
            createdAt: timestamp,
            updatedAt: timestamp
        },
        {
            id: 2,
            userId: 1,
            budgetId: 1,
            name: 'Rent',
            type: 'expense',
            parentId: null,
            kind: 'normal',
            createdAt: timestamp,
            updatedAt: timestamp
        },
        {
            id: 3,
            userId: 1,
            budgetId: 1,
            name: 'Salary',
            type: 'income',
            parentId: null,
            kind: 'normal',
            createdAt: timestamp,
            updatedAt: timestamp
        }
    ] as const satisfies readonly CategoryDb[];
    const vendors = [
        {
            id: 1,
            userId: 1,
            budgetId: 1,
            name: 'Market',
            normalizedName: 'market',
            domain: null,
            logoUrl: null,
            primaryColor: null,
            createdAt: timestamp,
            updatedAt: timestamp
        },
        {
            id: 2,
            userId: 1,
            budgetId: 1,
            name: 'Landlord',
            normalizedName: 'landlord',
            domain: null,
            logoUrl: null,
            primaryColor: null,
            createdAt: timestamp,
            updatedAt: timestamp
        }
    ] as const satisfies readonly VendorDb[];
    const tags = [
        {
            id: 10,
            userId: 1,
            name: 'me',
            createdAt: timestamp,
            updatedAt: timestamp
        },
        {
            id: 11,
            userId: 1,
            name: 'wife',
            createdAt: timestamp,
            updatedAt: timestamp
        }
    ] as const;
    const tagLinks = [
        { transactionId: 1, tagId: 10 },
        { transactionId: 2, tagId: 10 },
        { transactionId: 2, tagId: 11 },
        { transactionId: 4, tagId: 10 }
    ] as const;

    function transaction(
        id: number,
        categoryId: number,
        amount: string,
        vendorId?: number
    ): TransactionDb {
        return {
            id,
            userId: 1,
            budgetId: 1,
            categoryId,
            vendorId,
            type: categoryId === 3 ? 'income' : 'expense',
            amount,
            currency: 'USD',
            defaultCurrencyAmount: amount,
            defaultCurrency: 'USD',
            exchangeRate: '1',
            exchangeRateDate: '2026-05-10',
            occurredAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp
        };
    }

    function testTagReportDb(): AppDb {
        const transactions = [
            transaction(1, 1, '10', 1),
            transaction(2, 2, '20', 2),
            transaction(3, 1, '5'),
            transaction(4, 3, '100', 1)
        ];
        const knex = vi.fn((table: string) => {
            if (table === 'transaction_tag_links as link') {
                const query = {
                    transactionIds: [] as number[],
                    join: () => query,
                    where: () => query,
                    whereIn: (_field: string, ids: readonly number[]) => {
                        query.transactionIds = [...ids];
                        return query;
                    },
                    orderBy: () => query,
                    select: () =>
                        Promise.resolve(
                            tagLinks
                                .filter(link =>
                                    query.transactionIds.includes(
                                        link.transactionId
                                    )
                                )
                                .flatMap(link => {
                                    const tag = tags.find(
                                        candidate => candidate.id === link.tagId
                                    );
                                    return tag
                                        ? [
                                              {
                                                  transactionId:
                                                      link.transactionId,
                                                  id: tag.id,
                                                  name: tag.name,
                                                  createdAt: tag.createdAt,
                                                  updatedAt: tag.updatedAt
                                              }
                                          ]
                                        : [];
                                })
                        )
                };
                return query;
            }
            if (table === 'transaction_tag_links') {
                const query = {
                    tagIds: [] as number[],
                    whereIn: (_field: string, ids: readonly number[]) => {
                        query.tagIds = [...ids];
                        return query;
                    },
                    groupBy: () => query,
                    select: () => query,
                    count: () =>
                        Promise.resolve(
                            query.tagIds.map(tagId => ({
                                tagId,
                                transactionCount: tagLinks.filter(
                                    link => link.tagId === tagId
                                ).length
                            }))
                        )
                };
                return query;
            }
            if (table === 'transaction_tags') {
                const query = {
                    tagId: 0,
                    where: (field: string, value: number) => {
                        if (field === 'id') {
                            query.tagId = value;
                        }
                        return query;
                    },
                    select: () => query,
                    first: () =>
                        Promise.resolve(
                            tags.find(tag => tag.id === query.tagId)
                        )
                };
                return query;
            }
            throw new Error(`Unexpected table ${table}`);
        });

        return {
            ...budgetAccessTables(),
            knex,
            users: {
                find: async () => ({
                    id: 1,
                    defaultCurrency: 'USD',
                    mainBudgetId: 1,
                    timezone: 'UTC'
                })
            },
            transactions: {
                include: () => ({
                    where: () => ({
                        whereBetween: (
                            _field: unknown,
                            [from, to]: readonly [Date, Date]
                        ) =>
                            Promise.resolve(
                                transactions.filter(
                                    row =>
                                        row.occurredAt >= from &&
                                        row.occurredAt <= to
                                )
                            )
                    })
                })
            },
            categories: {
                where: async () => categories
            },
            vendors: {
                where: async () => vendors
            }
        } as unknown as AppDb;
    }

    it('uses full attribution for tag distribution and ignores income tags', async () => {
        const report = await statsTagReport(testTagReportDb(), 1, {
            period: 'month',
            date: new Date('2026-05-15T12:00:00.000Z'),
            tag: 10
        });

        expect(report.expenseTotal).toBe(35);
        expect(report.expenseCount).toBe(3);
        expect(report.untaggedCount).toBe(1);
        expect(
            report.tags.map(tag => ({
                kind: tag.kind,
                name: tag.tagName,
                total: tag.total,
                count: tag.transactionCount
            }))
        ).toEqual([
            { kind: 'tag', name: 'me', total: 30, count: 2 },
            { kind: 'tag', name: 'wife', total: 20, count: 1 },
            { kind: 'untagged', name: 'Untagged', total: 5, count: 1 }
        ]);
        expect(report.tags[0]?.share).toBeCloseTo((30 / 35) * 100);
        expect(report.selectedTag?.tagName).toBe('me');
        expect(report.selectedTag?.total).toBe(30);
        expect(report.selectedTag?.transactionCount).toBe(2);
        expect(
            report.selectedTag?.byCategory.map(category => ({
                name: category.categoryName,
                total: category.total
            }))
        ).toEqual([
            { name: 'Rent', total: 20 },
            { name: 'Groceries', total: 10 }
        ]);
        expect(report.selectedTag?.topVendors[0]?.vendorName).toBe('Landlord');
    });

    it('returns selected detail for the untagged bucket', async () => {
        const report = await statsTagReport(testTagReportDb(), 1, {
            period: 'month',
            date: new Date('2026-05-15T12:00:00.000Z'),
            tag: 'untagged'
        });

        expect(report.selectedTag).toMatchObject({
            kind: 'untagged',
            tagId: null,
            tagName: 'Untagged',
            total: 5,
            transactionCount: 1
        });
    });
});

describe('percentage changes', () => {
    it('calculates percentage change against the previous total', () => {
        expect(percentChange(150, 100)).toBe(50);
        expect(percentChange(75, 100)).toBe(-25);
        expect(percentChange(0, 100)).toBe(-100);
    });

    it('uses a finite fallback when the previous total is zero', () => {
        expect(percentChange(100, 0)).toBe(100);
        expect(percentChange(-100, 0)).toBe(-100);
        expect(percentChange(0, 0)).toBe(0);
    });
});
