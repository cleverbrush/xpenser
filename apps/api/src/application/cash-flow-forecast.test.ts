import type { Knex } from 'knex';
import { describe, expect, it, vi } from 'vitest';
import type { Config } from '../config.js';
import type {
    AppDb,
    CategoryDb,
    TransactionDb,
    UserDb,
    VendorDb
} from '../db/schemas.js';
import {
    buildCashFlowForecast,
    generateAndPersistCashFlowForecast
} from './cash-flow-forecast.js';

const timestamp = new Date('2026-06-16T12:00:00.000Z');

function user(overrides: Partial<UserDb> = {}): UserDb {
    return {
        id: 1,
        authProvider: 'local',
        countryCode: 'US',
        createdAt: timestamp,
        defaultCurrency: 'USD',
        email: 'test@example.com',
        emailVerified: true,
        monthlyEmailReportEnabled: true,
        role: 'user',
        timezone: 'UTC',
        updatedAt: timestamp,
        weeklyEmailReportEnabled: true,
        ...overrides
    };
}

function category(
    id: number,
    name: string,
    type: 'expense' | 'income',
    overrides: Partial<CategoryDb> = {}
): CategoryDb {
    return {
        id,
        userId: 1,
        archivedAt: null,
        createdAt: timestamp,
        kind: 'normal',
        name,
        parentId: null,
        type,
        updatedAt: timestamp,
        ...overrides
    };
}

function vendor(id: number, name: string): VendorDb {
    return {
        id,
        userId: 1,
        createdAt: timestamp,
        name,
        normalizedName: name.toLowerCase(),
        updatedAt: timestamp
    };
}

function transaction(
    id: number,
    categoryId: number,
    type: 'expense' | 'income',
    amount: number,
    occurredAt: string,
    overrides: Partial<TransactionDb> = {}
): TransactionDb {
    return {
        id,
        userId: 1,
        amount,
        categoryId,
        createdAt: new Date(occurredAt),
        currency: 'USD',
        defaultCurrency: 'USD',
        defaultCurrencyAmount: amount,
        exchangeRate: 1,
        exchangeRateDate: occurredAt.slice(0, 10),
        occurredAt: new Date(occurredAt),
        type,
        updatedAt: new Date(occurredAt),
        ...overrides
    };
}

function queryRows<T>(rows: readonly T[]) {
    let whereCalls = 0;
    const query = {
        include: () => query,
        where: () => {
            whereCalls += 1;
            return whereCalls >= 3 ? Promise.resolve(rows) : query;
        }
    };
    return query;
}

function forecastDb({
    categories,
    transactions,
    user,
    vendors
}: {
    readonly categories: readonly CategoryDb[];
    readonly transactions: readonly TransactionDb[];
    readonly user: UserDb;
    readonly vendors: readonly VendorDb[];
}): AppDb {
    return {
        users: {
            find: vi.fn().mockResolvedValue(user)
        },
        categories: {
            where: vi.fn().mockResolvedValue(categories)
        },
        vendors: {
            where: vi.fn().mockResolvedValue(vendors)
        },
        transactions: queryRows(transactions)
    } as unknown as AppDb;
}

function forecastKnex() {
    const inserts: Record<string, unknown>[] = [];
    const merges: Record<string, unknown>[] = [];
    const knex = vi.fn(() => ({
        insert: vi.fn((values: Record<string, unknown>) => {
            inserts.push(values);
            return {
                onConflict: vi.fn(() => ({
                    merge: vi.fn(async (values: Record<string, unknown>) => {
                        merges.push(values);
                    })
                }))
            };
        })
    }));

    return {
        inserts,
        knex: knex as unknown as Knex,
        merges
    };
}

describe('buildCashFlowForecast', () => {
    it('returns zero projections when no history is available', () => {
        const forecast = buildCashFlowForecast({
            categories: [category(1, 'Groceries', 'expense')],
            now: new Date('2026-06-16T08:00:00.000Z'),
            transactions: [],
            user: user(),
            vendors: []
        });

        expect(forecast.transactionCount).toBe(0);
        expect(forecast.recurringPatterns).toEqual([]);
        expect(
            forecast.windows.map(window => ({
                horizonDays: window.horizonDays,
                incomeTotal: window.incomeTotal,
                expenseTotal: window.expenseTotal,
                confidence: window.confidence
            }))
        ).toEqual([
            {
                horizonDays: 30,
                incomeTotal: 0,
                expenseTotal: 0,
                confidence: 'low'
            },
            {
                horizonDays: 90,
                incomeTotal: 0,
                expenseTotal: 0,
                confidence: 'low'
            }
        ]);
    });

    it('projects recurring monthly income and weekly expenses into 30 and 90 day windows', () => {
        const salary = category(1, 'Salary', 'income');
        const software = category(2, 'Software', 'expense');
        const payroll = vendor(1, 'Acme Payroll');
        const streaming = vendor(2, 'Streambox');
        const forecast = buildCashFlowForecast({
            categories: [salary, software],
            now: new Date('2026-06-16T08:00:00.000Z'),
            transactions: [
                transaction(
                    1,
                    salary.id,
                    'income',
                    3000,
                    '2026-03-01T12:00:00.000Z',
                    {
                        vendorId: payroll.id
                    }
                ),
                transaction(
                    2,
                    salary.id,
                    'income',
                    3000,
                    '2026-04-01T12:00:00.000Z',
                    {
                        vendorId: payroll.id
                    }
                ),
                transaction(
                    3,
                    salary.id,
                    'income',
                    3000,
                    '2026-05-01T12:00:00.000Z',
                    {
                        vendorId: payroll.id
                    }
                ),
                transaction(
                    4,
                    salary.id,
                    'income',
                    3000,
                    '2026-06-01T12:00:00.000Z',
                    {
                        vendorId: payroll.id
                    }
                ),
                transaction(
                    5,
                    software.id,
                    'expense',
                    20,
                    '2026-05-26T12:00:00.000Z',
                    {
                        vendorId: streaming.id
                    }
                ),
                transaction(
                    6,
                    software.id,
                    'expense',
                    20,
                    '2026-06-02T12:00:00.000Z',
                    {
                        vendorId: streaming.id
                    }
                ),
                transaction(
                    7,
                    software.id,
                    'expense',
                    20,
                    '2026-06-09T12:00:00.000Z',
                    {
                        vendorId: streaming.id
                    }
                )
            ],
            user: user(),
            vendors: [payroll, streaming]
        });

        expect(
            forecast.recurringPatterns.map(pattern => ({
                cadence: pattern.cadence,
                amount: pattern.amount,
                category: pattern.categoryDisplayName,
                vendor: pattern.vendorName,
                projectedCount: pattern.projectedCount
            }))
        ).toEqual([
            {
                cadence: 'monthly',
                amount: 3000,
                category: 'Salary',
                vendor: 'Acme Payroll',
                projectedCount: 3
            },
            {
                cadence: 'weekly',
                amount: 20,
                category: 'Software',
                vendor: 'Streambox',
                projectedCount: 13
            }
        ]);

        const thirty = forecast.windows.find(
            window => window.horizonDays === 30
        );
        const ninety = forecast.windows.find(
            window => window.horizonDays === 90
        );

        expect(thirty?.recurringIncomeTotal).toBe(3000);
        expect(thirty?.recurringExpenseTotal).toBe(100);
        expect(ninety?.recurringIncomeTotal).toBe(9000);
        expect(ninety?.recurringExpenseTotal).toBe(260);
    });

    it('does not double-count recurring history in the non-recurring baseline', () => {
        const salary = category(1, 'Salary', 'income');
        const payroll = vendor(1, 'Acme Payroll');
        const forecast = buildCashFlowForecast({
            categories: [salary],
            now: new Date('2026-06-16T08:00:00.000Z'),
            transactions: [
                transaction(
                    1,
                    salary.id,
                    'income',
                    3000,
                    '2026-03-01T12:00:00.000Z',
                    {
                        vendorId: payroll.id
                    }
                ),
                transaction(
                    2,
                    salary.id,
                    'income',
                    3000,
                    '2026-04-01T12:00:00.000Z',
                    {
                        vendorId: payroll.id
                    }
                ),
                transaction(
                    3,
                    salary.id,
                    'income',
                    3000,
                    '2026-05-01T12:00:00.000Z',
                    {
                        vendorId: payroll.id
                    }
                ),
                transaction(
                    4,
                    salary.id,
                    'income',
                    3000,
                    '2026-06-01T12:00:00.000Z',
                    {
                        vendorId: payroll.id
                    }
                )
            ],
            user: user(),
            vendors: [payroll]
        });
        const thirty = forecast.windows.find(
            window => window.horizonDays === 30
        );

        expect(thirty?.baselineIncomeTotal).toBe(0);
        expect(thirty?.incomeTotal).toBe(3000);
    });

    it('persists deterministic forecast when OpenAI is not configured', async () => {
        const salary = category(1, 'Salary', 'income');
        const db = forecastDb({
            categories: [salary],
            transactions: [],
            user: user(),
            vendors: []
        });
        const { inserts, knex } = forecastKnex();
        const config = {
            openai: {
                apiKey: undefined,
                reportModel: 'gpt-5-mini'
            },
            cashFlowForecasts: {
                insightTimeoutMs: 45_000
            }
        } as Config;

        const result = await generateAndPersistCashFlowForecast(
            db,
            knex,
            config,
            { warn: vi.fn() },
            1,
            { date: new Date('2026-06-16T08:00:00.000Z') },
            { force: true }
        );

        expect(result.status).toBe('complete');
        expect(result.forecast.insightsStatus).toBe('unavailable');
        expect(inserts).toHaveLength(2);
        expect(inserts[0]?.status).toBe('pending');
        expect(inserts[1]?.status).toBe('complete');
        expect(
            JSON.parse(String(inserts[1]?.forecast_json)).insightsStatus
        ).toBe('unavailable');
    });
});
