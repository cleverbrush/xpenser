import { describe, expect, it } from 'vitest';
import {
    dueEmailReportTypes,
    emailReportOpenAiPayload,
    emailReportPeriod
} from './email-reports.js';

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
                    type: 'income'
                }
            ]
        });

        const transaction = payload.report.notableTransactions.at(0);
        expect(transaction).toMatchObject({
            amount: 25,
            categoryImpact: 25,
            categoryKind: 'offset',
            netImpact: 25,
            type: 'income'
        });
        expect(transaction?.interpretation).toContain(
            'do not describe it as new spending'
        );
        expect(payload.report.dataSemantics.categoryKinds.offset).toContain(
            'opposite side'
        );
    });
});
