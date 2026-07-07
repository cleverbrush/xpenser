import { describe, expect, it } from 'vitest';
import type { CategoryDb, TransactionDb, VendorDb } from '../db/schemas.js';
import {
    dueEmailReportTypes,
    emailReportOpenAiPayload,
    emailReportPeriod,
    notedTransactionsForReport
} from './email-reports.js';

const timestamp = new Date('2026-05-01T00:00:00.000Z');
const groceries = {
    id: 1,
    userId: 1,
    budgetId: 1,
    parentId: null,
    name: 'Groceries',
    type: 'expense',
    kind: 'normal',
    createdAt: timestamp,
    updatedAt: timestamp
} satisfies CategoryDb;
const walmart = {
    id: 7,
    userId: 1,
    budgetId: 1,
    name: 'Walmart',
    normalizedName: 'walmart',
    resolvedName: 'Walmart',
    domain: 'walmart.com',
    description: 'Retail store',
    logoUrl: null,
    primaryColor: null,
    enrichmentProvider: 'brandfetch',
    enrichmentStatus: 'success',
    enrichedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
} satisfies VendorDb;

function transaction({
    amount,
    id,
    note,
    occurredAt = new Date(
        `2026-05-${String(id).padStart(2, '0')}T12:00:00.000Z`
    ),
    vendorId
}: {
    readonly amount: number;
    readonly id: number;
    readonly note?: string | null;
    readonly occurredAt?: Date;
    readonly vendorId?: number;
}): TransactionDb {
    return {
        id,
        userId: 1,
        budgetId: 1,
        categoryId: groceries.id,
        category: groceries,
        type: 'expense',
        amount,
        currency: 'USD',
        defaultCurrencyAmount: amount,
        defaultCurrency: 'USD',
        exchangeRate: 1,
        exchangeRateDate: '2026-05-01',
        occurredAt,
        vendorId,
        ...(note === undefined ? {} : { note }),
        createdAt: timestamp,
        updatedAt: timestamp
    };
}

describe('email report periods', () => {
    it('uses the previous complete local week for weekly reports', () => {
        const period = emailReportPeriod(
            'weekly',
            new Date('2026-06-01T13:00:00.000Z'),
            'UTC'
        );

        expect(period.from).toEqual(new Date('2026-05-25T00:00:00.000Z'));
        expect(period.to).toEqual(new Date('2026-05-31T23:59:59.999Z'));
    });

    it('uses the previous complete local month for monthly reports', () => {
        const period = emailReportPeriod(
            'monthly',
            new Date('2026-06-01T13:00:00.000Z'),
            'UTC'
        );

        expect(period.from).toEqual(new Date('2026-05-01T00:00:00.000Z'));
        expect(period.to).toEqual(new Date('2026-05-31T23:59:59.999Z'));
    });
});

describe('email report due checks', () => {
    it('sends weekly reports on Monday after the local delivery hour', () => {
        expect(
            dueEmailReportTypes(
                {
                    timezone: 'UTC',
                    weeklyEmailReportEnabled: true,
                    monthlyEmailReportEnabled: true
                },
                new Date('2026-06-01T08:05:00.000Z'),
                8
            )
        ).toEqual(['weekly', 'monthly']);
    });

    it('does not send before the local delivery hour', () => {
        expect(
            dueEmailReportTypes(
                {
                    timezone: 'UTC',
                    weeklyEmailReportEnabled: true,
                    monthlyEmailReportEnabled: true
                },
                new Date('2026-06-01T07:59:00.000Z'),
                8
            )
        ).toEqual([]);
    });

    it('respects disabled user preferences', () => {
        expect(
            dueEmailReportTypes(
                {
                    timezone: 'UTC',
                    weeklyEmailReportEnabled: false,
                    monthlyEmailReportEnabled: true
                },
                new Date('2026-06-01T08:05:00.000Z'),
                8
            )
        ).toEqual(['monthly']);
    });
});

describe('email report OpenAI payload', () => {
    it('labels expense-parent offset categories as income returns', () => {
        const payload = emailReportOpenAiPayload({
            budgetId: 1,
            budgetName: 'Main',
            type: 'weekly',
            period: {
                from: new Date('2026-05-25T00:00:00.000Z'),
                to: new Date('2026-05-31T23:59:59.999Z')
            },
            periodLabel: '25 May 2026 - 31 May 2026',
            currency: 'USD',
            incomeTotal: 0,
            expenseTotal: 75,
            netTotal: -75,
            savingsRate: 0,
            transactionCount: 2,
            averageIncome: 0,
            averageExpense: 37.5,
            previousPeriod: {
                incomeTotal: 0,
                expenseTotal: 100,
                netTotal: -100,
                transactionCount: 1
            },
            topExpenseCategories: [],
            topIncomeCategories: [],
            vendors: [
                {
                    name: 'Walmart',
                    domain: 'walmart.com',
                    description: 'Retail store',
                    expenseTotal: 50,
                    shareOfExpenses: 66.66666666666666,
                    transactionCount: 1,
                    topCategories: ['Groceries']
                }
            ],
            trend: [],
            notableTransactions: [
                {
                    amount: 25,
                    categoryImpact: 25,
                    categoryKind: 'offset',
                    categoryName: 'Travel',
                    date: '2026-05-27',
                    interpretation:
                        'Return or refund category. It counts as income and improves net position; do not describe it as new spending.',
                    netImpact: 25,
                    note: 'Refund from delayed baggage claim.',
                    type: 'income',
                    vendorDomain: 'walmart.com',
                    vendorName: 'Walmart'
                }
            ],
            notedTransactions: [
                {
                    amount: 25,
                    categoryImpact: 25,
                    categoryKind: 'offset',
                    categoryName: 'Travel',
                    date: '2026-05-27',
                    interpretation:
                        'Return or refund category. It counts as income and improves net position; do not describe it as new spending.',
                    netImpact: 25,
                    note: 'Refund from delayed baggage claim.',
                    type: 'income',
                    vendorDomain: 'walmart.com',
                    vendorName: 'Walmart'
                }
            ]
        });

        const transaction = payload.report.notableTransactions.at(0);
        expect(transaction).toMatchObject({
            amount: 25,
            categoryImpact: 25,
            categoryKind: 'offset',
            netImpact: 25,
            note: 'Refund from delayed baggage claim.',
            type: 'income'
        });
        expect(payload.report.notedTransactions).toHaveLength(1);
        expect(payload.report.notedTransactions[0]?.note).toBe(
            'Refund from delayed baggage claim.'
        );
        expect(payload.report.vendors).toEqual([
            expect.objectContaining({
                name: 'Walmart',
                domain: 'walmart.com',
                topCategories: ['Groceries']
            })
        ]);
        expect(transaction?.vendorName).toBe('Walmart');
        expect(transaction?.interpretation).toContain(
            'do not describe it as new spending'
        );
        expect(payload.report.dataSemantics.categoryKinds.offset).toContain(
            'opposite side'
        );
        expect(payload.report.dataSemantics.notes).toContain(
            'user-provided context'
        );
    });

    it('caps and orders noted transactions by impact and recency', () => {
        const notedTransactions = notedTransactionsForReport(
            [
                transaction({
                    amount: 30,
                    id: 1,
                    note: 'Lower impact',
                    vendorId: walmart.id
                }),
                transaction({
                    amount: 50,
                    id: 2,
                    note: 'Older high impact',
                    occurredAt: new Date('2026-05-05T12:00:00.000Z')
                }),
                transaction({
                    amount: 50,
                    id: 3,
                    note: 'Newer high impact',
                    occurredAt: new Date('2026-05-06T12:00:00.000Z')
                }),
                transaction({
                    amount: 100,
                    id: 4,
                    note: '   '
                }),
                ...Array.from({ length: 12 }, (_, index) =>
                    transaction({
                        amount: 20 - index,
                        id: index + 5,
                        note: `Capped note ${index + 1}`
                    })
                )
            ],
            'UTC',
            new Map([[groceries.id, groceries]]),
            new Map([[walmart.id, walmart]])
        );

        expect(notedTransactions).toHaveLength(10);
        expect(notedTransactions.slice(0, 3).map(item => item.note)).toEqual([
            'Newer high impact',
            'Older high impact',
            'Lower impact'
        ]);
        expect(notedTransactions).not.toContainEqual(
            expect.objectContaining({ note: '' })
        );
        expect(notedTransactions).not.toContainEqual(
            expect.objectContaining({ note: '   ' })
        );
        expect(notedTransactions[2]).toMatchObject({
            note: 'Lower impact',
            vendorDomain: 'walmart.com',
            vendorName: 'Walmart'
        });
    });
});
