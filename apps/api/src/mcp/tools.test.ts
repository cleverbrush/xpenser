import type {
    DashboardSummary,
    StatsOverview,
    TransactionListQuery
} from '@xpenser/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpApiKeyPrincipal } from './auth.js';
import {
    handleGetCurrentUser,
    handleGetDashboardSummary,
    handleGetStatsOverview,
    handleListCategories,
    handleListTransactions,
    normalizeTransactionListInput,
    serializeMcpData,
    type XpenserMcpDataAccess,
    type XpenserMcpToolContext
} from './tools.js';

const principal: McpApiKeyPrincipal = {
    userId: 7,
    role: 'user',
    authType: 'api_key',
    apiKeyId: 42
};

function statsOverview(): StatsOverview {
    return {
        groupBy: 'day',
        timeframe: 'this-month',
        from: new Date('2026-05-01T00:00:00.000Z'),
        to: new Date('2026-05-14T12:00:00.000Z'),
        currency: 'USD',
        expenseTotal: 50,
        incomeTotal: 100,
        netTotal: 50,
        savingsRate: 50,
        transactionCount: 2,
        expenseCount: 1,
        incomeCount: 1,
        averageExpense: 50,
        averageIncome: 100,
        largestExpenseCategory: 'Food',
        largestIncomeCategory: 'Salary',
        trend: [],
        byCategory: [],
        byParentCategory: [],
        comparison: {
            previousPeriod: {
                from: new Date('2026-04-01T00:00:00.000Z'),
                to: new Date('2026-04-14T12:00:00.000Z'),
                expenseTotal: 40,
                incomeTotal: 90,
                netTotal: 50,
                transactionCount: 2,
                expenseCount: 1,
                incomeCount: 1
            },
            previousYear: {
                from: new Date('2025-05-01T00:00:00.000Z'),
                to: new Date('2025-05-14T12:00:00.000Z'),
                expenseTotal: 35,
                incomeTotal: 80,
                netTotal: 45,
                transactionCount: 2,
                expenseCount: 1,
                incomeCount: 1
            }
        }
    };
}

function dashboardSummary(): DashboardSummary {
    return {
        period: 'month',
        from: new Date('2026-05-01T00:00:00.000Z'),
        to: new Date('2026-05-14T12:00:00.000Z'),
        currency: 'USD',
        expenseTotal: 50,
        incomeTotal: 100,
        merchantCount: 0,
        topMerchants: [],
        byCategory: [],
        byParentCategory: []
    };
}

describe('MCP tool helpers', () => {
    let data: XpenserMcpDataAccess;
    let context: XpenserMcpToolContext;

    beforeEach(() => {
        data = {
            getCurrentUser: vi.fn(async () => ({
                id: 7,
                email: 'jane@example.com',
                defaultCurrency: 'USD',
                countryCode: 'US',
                favoriteCurrencies: ['EUR'],
                transactionCurrencies: ['USD', 'EUR'],
                timezone: 'UTC',
                hasCategories: true,
                weeklyEmailReportEnabled: true,
                monthlyEmailReportEnabled: true
            })),
            listCategories: vi.fn(async () => [
                {
                    id: 1,
                    name: 'Food',
                    type: 'expense' as const,
                    parentId: null,
                    kind: 'normal' as const,
                    displayName: 'Food',
                    inUse: true,
                    hasChildren: false,
                    archivedAt: null,
                    createdAt: new Date('2026-05-01T00:00:00.000Z'),
                    updatedAt: new Date('2026-05-02T00:00:00.000Z')
                }
            ]),
            listTransactions: vi.fn(
                async (_userId: number, query: TransactionListQuery) => ({
                    items: [
                        {
                            id: 100,
                            categoryId: 1,
                            merchantId: null,
                            categoryName: 'Food',
                            categoryDisplayName: 'Food',
                            categoryParentId: null,
                            categoryKind: 'normal' as const,
                            type: 'expense' as const,
                            amount: 12.34,
                            currency: 'USD',
                            defaultCurrencyAmount: 12.34,
                            defaultCurrency: 'USD',
                            exchangeRate: 1,
                            exchangeRateDate: '2026-05-14',
                            occurredAt:
                                query.from ??
                                new Date('2026-05-14T00:00:00.000Z'),
                            note: 'Lunch',
                            createdAt: new Date('2026-05-14T01:00:00.000Z'),
                            updatedAt: new Date('2026-05-14T01:00:00.000Z')
                        }
                    ],
                    total: 1,
                    page: query.page ?? 1,
                    limit: query.limit ?? 50
                })
            ),
            getDashboardSummary: vi.fn(async () => dashboardSummary()),
            getStatsOverview: vi.fn(async () => statsOverview())
        };
        context = {
            principal,
            data,
            logger: { info: vi.fn() }
        };
    });

    it('normalizes transaction pagination and dates', () => {
        const query = normalizeTransactionListInput({
            search: '  food  ',
            from: '2026-05-01T00:00:00.000Z',
            merchantId: 12,
            limit: 250
        });

        expect(query).toMatchObject({
            search: 'food',
            merchantId: 12,
            page: 1,
            limit: 100,
            direction: 'desc'
        } satisfies Partial<TransactionListQuery>);
        expect(query.from).toEqual(new Date('2026-05-01T00:00:00.000Z'));
    });

    it('serializes dates to ISO strings for MCP structured content', () => {
        expect(
            serializeMcpData({
                happenedAt: new Date('2026-05-14T00:00:00.000Z'),
                nested: [{ value: undefined, kept: true }]
            })
        ).toEqual({
            happenedAt: '2026-05-14T00:00:00.000Z',
            nested: [{ kept: true }]
        });
    });

    it('delegates current user reads to the authenticated user', async () => {
        const result = await handleGetCurrentUser(context);

        expect(data.getCurrentUser).toHaveBeenCalledWith(7);
        expect(result.structuredContent).toMatchObject({
            user: { id: 7, email: 'jane@example.com' }
        });
    });

    it('delegates category reads to the authenticated user', async () => {
        const result = await handleListCategories(context);

        expect(data.listCategories).toHaveBeenCalledWith(7);
        expect(result.structuredContent).toMatchObject({
            categories: [{ id: 1, createdAt: '2026-05-01T00:00:00.000Z' }]
        });
    });

    it('delegates transaction reads with capped query params', async () => {
        const result = await handleListTransactions(context, {
            from: '2026-05-14T00:00:00.000Z',
            limit: 1000
        });

        expect(data.listTransactions).toHaveBeenCalledWith(
            7,
            expect.objectContaining({
                from: new Date('2026-05-14T00:00:00.000Z'),
                page: 1,
                limit: 100,
                direction: 'desc'
            })
        );
        expect(result.structuredContent).toMatchObject({
            transactions: {
                items: [
                    {
                        occurredAt: '2026-05-14T00:00:00.000Z',
                        createdAt: '2026-05-14T01:00:00.000Z'
                    }
                ]
            }
        });
    });

    it('delegates dashboard summary reads with period controls', async () => {
        const result = await handleGetDashboardSummary(context, {
            period: 'month',
            date: '2026-05-14T00:00:00.000Z'
        });

        expect(data.getDashboardSummary).toHaveBeenCalledWith(
            7,
            'month',
            new Date('2026-05-14T00:00:00.000Z')
        );
        expect(result.structuredContent).toMatchObject({
            dashboard: { from: '2026-05-01T00:00:00.000Z' }
        });
    });

    it('delegates stats overview reads with normalized defaults', async () => {
        const result = await handleGetStatsOverview(context, {
            timeframe: 'custom',
            from: '2026-05-01T00:00:00.000Z',
            to: '2026-05-14T00:00:00.000Z'
        });

        expect(data.getStatsOverview).toHaveBeenCalledWith(
            7,
            expect.objectContaining({
                groupBy: 'day',
                timeframe: 'custom',
                from: new Date('2026-05-01T00:00:00.000Z'),
                to: new Date('2026-05-14T00:00:00.000Z')
            })
        );
        expect(result.structuredContent).toMatchObject({
            stats: {
                from: '2026-05-01T00:00:00.000Z',
                comparison: {
                    previousYear: {
                        from: '2025-05-01T00:00:00.000Z'
                    }
                }
            }
        });
    });
});
