import { ErrorCode, type McpError } from '@modelcontextprotocol/sdk/types.js';
import type {
    Category,
    DashboardSummary,
    StatsOverview,
    Transaction,
    TransactionListQuery,
    TransactionTag,
    Vendor,
    VendorCandidate
} from '@xpenser/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionCategoryError } from '../application/transactions.js';
import { VendorNameError } from '../application/vendors.js';
import type { McpPrincipal } from './auth.js';
import {
    createXpenserMcpTools,
    handleCreateCategory,
    handleCreateTransaction,
    handleDeleteCategory,
    handleDeleteTransaction,
    handleGetCurrentUser,
    handleGetDashboardSummary,
    handleGetStatsOverview,
    handleGetVendorCandidateDetails,
    handleListCategories,
    handleListTransactions,
    handleListTransactionTags,
    handleMoveAndDeleteCategory,
    handleSearchVendorCandidates,
    handleUpdateTransaction,
    handleUpdateVendor,
    normalizeCreateTransactionInput,
    normalizeTransactionListInput,
    normalizeTransactionTagListInput,
    serializeMcpData,
    type XpenserMcpDataAccess,
    type XpenserMcpToolContext
} from './tools.js';

const principal: McpPrincipal = {
    userId: 7,
    role: 'user',
    authType: 'api_key',
    apiKeyId: 42
};

function category(overrides: Partial<Category> = {}): Category {
    return {
        id: 1,
        name: 'Food',
        type: 'expense',
        parentId: null,
        kind: 'normal',
        displayName: 'Food',
        inUse: true,
        hasChildren: false,
        archivedAt: null,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-02T00:00:00.000Z'),
        ...overrides
    };
}

function vendor(overrides: Partial<Vendor> = {}): Vendor {
    return {
        id: 5,
        name: 'Store',
        displayName: 'Store',
        domain: 'store.example',
        transactionCount: 1,
        createdAt: new Date('2026-05-03T00:00:00.000Z'),
        updatedAt: new Date('2026-05-04T00:00:00.000Z'),
        ...overrides
    };
}

function vendorCandidate(
    overrides: Partial<VendorCandidate> = {}
): VendorCandidate {
    return {
        brandfetchBrandId: 'brand_1',
        name: 'Store',
        domain: 'store.example',
        logoUrl: 'https://store.example/logo.svg',
        ...overrides
    };
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
    return {
        id: 100,
        categoryId: 1,
        vendorId: null,
        categoryName: 'Food',
        categoryDisplayName: 'Food',
        categoryParentId: null,
        categoryKind: 'normal',
        type: 'expense',
        amount: 12.34,
        currency: 'USD',
        defaultCurrencyAmount: 12.34,
        defaultCurrency: 'USD',
        exchangeRate: 1,
        exchangeRateDate: '2026-05-14',
        occurredAt: new Date('2026-05-14T00:00:00.000Z'),
        note: 'Lunch',
        tags: [],
        scanAttachment: null,
        createdAt: new Date('2026-05-14T01:00:00.000Z'),
        updatedAt: new Date('2026-05-14T01:00:00.000Z'),
        ...overrides
    };
}

function transactionTag(
    overrides: Partial<TransactionTag> = {}
): TransactionTag {
    return {
        id: 9,
        name: 'wife',
        transactionCount: 2,
        createdAt: new Date('2026-05-06T00:00:00.000Z'),
        updatedAt: new Date('2026-05-07T00:00:00.000Z'),
        ...overrides
    };
}

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
        comparison: {
            previousPeriod: {
                from: new Date('2026-04-01T00:00:00.000Z'),
                to: new Date('2026-04-30T23:59:59.999Z'),
                expenseTotal: 40,
                incomeTotal: 90,
                netTotal: 50
            }
        },
        vendorCount: 0,
        topVendors: [],
        categoryVendorBreakdown: [],
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
            listCategories: vi.fn(async () => [category()]),
            createCategory: vi.fn(async (_userId, body) =>
                category({
                    id: 2,
                    name: body.name,
                    type: body.type,
                    parentId: body.parentId ?? null,
                    kind: body.kind ?? 'normal',
                    displayName: body.name,
                    inUse: false
                })
            ),
            updateCategory: vi.fn(async (_userId, id, body) =>
                category({
                    id,
                    name: body.name ?? 'Food',
                    archivedAt: body.archived
                        ? new Date('2026-05-05T00:00:00.000Z')
                        : null
                })
            ),
            deleteCategory: vi.fn(async () => undefined),
            moveAndDeleteCategory: vi.fn(async () => undefined),
            listVendors: vi.fn(async () => [vendor()]),
            getVendor: vi.fn(async (_userId, id) => vendor({ id })),
            searchVendorCandidates: vi.fn(async () => [vendorCandidate()]),
            getVendorCandidateDetails: vi.fn(async query =>
                query.domain
                    ? vendorCandidate({ domain: query.domain })
                    : undefined
            ),
            createVendor: vi.fn(async (_userId, body) =>
                vendor({
                    id: 6,
                    name: body.name,
                    displayName: body.name,
                    domain: body.domain
                })
            ),
            updateVendor: vi.fn(async (_userId, id, body) =>
                vendor({
                    id,
                    name: body.name ?? 'Store',
                    displayName: body.name ?? 'Store',
                    domain: body.domain ?? undefined
                })
            ),
            enrichVendor: vi.fn(async (_userId, id) =>
                vendor({ id, enrichmentStatus: 'success' })
            ),
            listTransactions: vi.fn(
                async (_userId: number, query: TransactionListQuery) => ({
                    items: [
                        transaction({
                            occurredAt:
                                query.from ??
                                new Date('2026-05-14T00:00:00.000Z')
                        })
                    ],
                    total: 1,
                    page: query.page ?? 1,
                    limit: query.limit ?? 50
                })
            ),
            listTransactionTags: vi.fn(async () => [transactionTag()]),
            createTransaction: vi.fn(async (_userId, body) =>
                transaction({
                    id: 101,
                    categoryId: body.categoryId,
                    vendorId: body.vendorId ?? null,
                    amount: body.amount,
                    currency: body.currency,
                    occurredAt: body.occurredAt,
                    note: body.note,
                    tags: (body.tags ?? []).map((name: string, index: number) =>
                        transactionTag({ id: index + 1, name })
                    )
                })
            ),
            updateTransaction: vi.fn(async (_userId, id, body) =>
                transaction({
                    id,
                    categoryId: body.categoryId ?? 1,
                    vendorId: body.vendorId ?? null,
                    amount: body.amount ?? 12.34,
                    currency: body.currency ?? 'USD',
                    occurredAt:
                        body.occurredAt ?? new Date('2026-05-14T00:00:00.000Z'),
                    note: body.note,
                    tags: (body.tags ?? []).map((name: string, index: number) =>
                        transactionTag({ id: index + 1, name })
                    )
                })
            ),
            deleteTransaction: vi.fn(async () => undefined),
            getDashboardSummary: vi.fn(async () => dashboardSummary()),
            getStatsOverview: vi.fn(async () => statsOverview())
        };
        context = {
            principal,
            data,
            logger: { info: vi.fn(), warn: vi.fn() }
        };
    });

    it('advertises read, write, destructive, and open-world annotations', () => {
        const tools = createXpenserMcpTools(context);

        expect(tools.map(tool => tool.name)).toEqual([
            'xpenser_get_current_user',
            'xpenser_list_categories',
            'xpenser_create_category',
            'xpenser_update_category',
            'xpenser_delete_category',
            'xpenser_move_and_delete_category',
            'xpenser_list_vendors',
            'xpenser_get_vendor',
            'xpenser_search_vendor_candidates',
            'xpenser_get_vendor_candidate_details',
            'xpenser_create_vendor',
            'xpenser_update_vendor',
            'xpenser_enrich_vendor',
            'xpenser_list_transactions',
            'xpenser_list_transaction_tags',
            'xpenser_create_transaction',
            'xpenser_update_transaction',
            'xpenser_delete_transaction',
            'xpenser_get_dashboard_summary',
            'xpenser_get_stats_overview'
        ]);
        expect(
            tools.find(tool => tool.name === 'xpenser_search_vendor_candidates')
                ?.annotations
        ).toMatchObject({ readOnlyHint: true, openWorldHint: true });
        expect(
            tools.find(tool => tool.name === 'xpenser_create_transaction')
                ?.annotations
        ).toMatchObject({
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true
        });
        expect(
            tools.find(tool => tool.name === 'xpenser_delete_transaction')
                ?.annotations
        ).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    });

    it('normalizes transaction pagination and dates', () => {
        const query = normalizeTransactionListInput({
            search: '  food  ',
            from: '2026-05-01T00:00:00.000Z',
            vendorId: 12,
            tagIds: [2, 5],
            limit: 250
        });

        expect(query).toMatchObject({
            search: 'food',
            vendorId: 12,
            tagIds: '2,5',
            page: 1,
            limit: 100,
            direction: 'desc'
        } satisfies Partial<TransactionListQuery>);
        expect(query.from).toEqual(new Date('2026-05-01T00:00:00.000Z'));
    });

    it('normalizes transaction tag list filters', () => {
        expect(
            normalizeTransactionTagListInput({
                search: '  wife  ',
                limit: 500
            })
        ).toEqual({
            search: 'wife',
            limit: 100
        });
    });

    it('normalizes transaction creation dates', () => {
        expect(
            normalizeCreateTransactionInput({
                categoryId: 1,
                amount: 10,
                currency: 'USD',
                occurredAt: '2026-05-10T12:00:00.000Z'
            }).occurredAt
        ).toEqual(new Date('2026-05-10T12:00:00.000Z'));
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

    it('delegates category reads with MCP filters', async () => {
        const result = await handleListCategories(context, {
            activeOnly: true,
            sort: 'recent-transaction-count'
        });

        expect(data.listCategories).toHaveBeenCalledWith(7, {
            activeOnly: true,
            sort: 'recent-transaction-count'
        });
        expect(result.structuredContent).toMatchObject({
            categories: [{ id: 1, createdAt: '2026-05-01T00:00:00.000Z' }]
        });
    });

    it('delegates category writes and delete cleanup responses', async () => {
        const created = await handleCreateCategory(context, {
            name: 'Books',
            type: 'expense'
        });
        const deleted = await handleDeleteCategory(context, { id: 2 });
        const moved = await handleMoveAndDeleteCategory(context, {
            id: 3,
            replacementCategoryId: 4
        });

        expect(data.createCategory).toHaveBeenCalledWith(7, {
            name: 'Books',
            type: 'expense'
        });
        expect(created.structuredContent).toMatchObject({
            category: { id: 2, name: 'Books' }
        });
        expect(data.deleteCategory).toHaveBeenCalledWith(7, 2);
        expect(deleted.structuredContent).toEqual({ deleted: true, id: 2 });
        expect(data.moveAndDeleteCategory).toHaveBeenCalledWith(7, 3, 4);
        expect(moved.structuredContent).toEqual({
            deleted: true,
            id: 3,
            replacementCategoryId: 4
        });
    });

    it('delegates vendor candidate tools', async () => {
        const candidates = await handleSearchVendorCandidates(context, {
            query: 'Store',
            limit: 3
        });
        const details = await handleGetVendorCandidateDetails(context, {
            domain: 'store.example'
        });
        const missingDetails = await handleGetVendorCandidateDetails(context, {
            brandfetchBrandId: 'missing'
        });

        expect(data.searchVendorCandidates).toHaveBeenCalledWith({
            query: 'Store',
            limit: 3
        });
        expect(candidates.structuredContent).toMatchObject({
            vendorCandidates: [{ name: 'Store' }]
        });
        expect(details.structuredContent).toMatchObject({
            vendorCandidate: { domain: 'store.example' }
        });
        expect(missingDetails.structuredContent).toEqual({
            vendorCandidate: null
        });
    });

    it('maps expected vendor write errors to MCP invalid params', async () => {
        vi.mocked(data.updateVendor).mockRejectedValueOnce(
            new VendorNameError('A vendor with this name already exists.')
        );

        await expect(
            handleUpdateVendor(context, { id: 5, name: 'Store' })
        ).rejects.toSatisfy(
            (error: McpError) =>
                error.code === ErrorCode.InvalidParams &&
                error.message.includes(
                    'A vendor with this name already exists.'
                )
        );
        expect(context.logger.warn).toHaveBeenCalled();
    });

    it('delegates transaction reads with capped query params', async () => {
        const result = await handleListTransactions(context, {
            from: '2026-05-14T00:00:00.000Z',
            tagIds: [2, 5],
            limit: 1000
        });

        expect(data.listTransactions).toHaveBeenCalledWith(
            7,
            expect.objectContaining({
                from: new Date('2026-05-14T00:00:00.000Z'),
                tagIds: '2,5',
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

    it('delegates transaction tag reads', async () => {
        const result = await handleListTransactionTags(context, {
            search: 'wife',
            limit: 10
        });

        expect(data.listTransactionTags).toHaveBeenCalledWith(7, {
            search: 'wife',
            limit: 10
        });
        expect(result.structuredContent).toMatchObject({
            tags: [
                {
                    id: 9,
                    name: 'wife',
                    transactionCount: 2,
                    createdAt: '2026-05-06T00:00:00.000Z'
                }
            ]
        });
    });

    it('delegates transaction writes with normalized dates', async () => {
        const created = await handleCreateTransaction(context, {
            categoryId: 1,
            vendorId: 5,
            amount: 12.34,
            currency: 'USD',
            occurredAt: '2026-05-15T00:00:00.000Z',
            note: 'Dinner',
            tags: ['wife']
        });
        const updated = await handleUpdateTransaction(context, {
            id: 101,
            amount: 20,
            occurredAt: '2026-05-16T00:00:00.000Z',
            note: '',
            tags: []
        });
        const deleted = await handleDeleteTransaction(context, { id: 101 });

        expect(data.createTransaction).toHaveBeenCalledWith(
            7,
            expect.objectContaining({
                categoryId: 1,
                vendorId: 5,
                tags: ['wife'],
                occurredAt: new Date('2026-05-15T00:00:00.000Z')
            })
        );
        expect(context.logger.info).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ TransactionId: 101, UserId: 7 })
        );
        expect(created.structuredContent).toMatchObject({
            transaction: { id: 101, note: 'Dinner' }
        });
        expect(data.updateTransaction).toHaveBeenCalledWith(
            7,
            101,
            expect.objectContaining({
                amount: 20,
                occurredAt: new Date('2026-05-16T00:00:00.000Z'),
                note: '',
                tags: []
            })
        );
        expect(updated.structuredContent).toMatchObject({
            transaction: { id: 101, note: '' }
        });
        expect(data.deleteTransaction).toHaveBeenCalledWith(7, 101);
        expect(deleted.structuredContent).toEqual({ deleted: true, id: 101 });
    });

    it('maps expected transaction write errors to MCP invalid params', async () => {
        vi.mocked(data.createTransaction).mockRejectedValueOnce(
            new TransactionCategoryError('Category was not found.')
        );

        await expect(
            handleCreateTransaction(context, {
                categoryId: 999,
                amount: 12,
                currency: 'USD',
                occurredAt: '2026-05-15T00:00:00.000Z'
            })
        ).rejects.toSatisfy(
            (error: McpError) =>
                error.code === ErrorCode.InvalidParams &&
                error.message.includes('Category was not found.')
        );
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
