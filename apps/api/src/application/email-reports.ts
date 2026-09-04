import { getTableName, query as schemaQuery } from '@cleverbrush/knex-schema';
import type { Logger } from '@cleverbrush/log';
import type { StatsOverview } from '@xpenser/contracts';
import {
    addLocalDays,
    addLocalMonths,
    dateToLocalDateParam,
    localStartOfMonth,
    localStartOfWeek
} from '@xpenser/timezone';
import type { Knex } from 'knex';
import type { Config } from '../config.js';
import {
    type AppDb,
    type BudgetDb,
    BudgetDbSchema,
    type BudgetMemberDb,
    BudgetMemberDbSchema,
    type CategoryDb,
    type EmailReportDeliveryDb,
    EmailReportDeliveryDbSchema,
    type TransactionDb,
    type UserDb,
    UserDbSchema,
    type VendorDb
} from '../db/schemas.js';
import { categoryDisplayName, categoryReportingType } from './categories.js';
import { sendEmail as sendProviderEmail } from './email.js';
import { generateStructuredJson } from './openai.js';
import {
    statsOverview,
    transactionSignedDefaultAmount
} from './transactions.js';

export type EmailReportType = 'monthly' | 'weekly';

type ReportTrigger = 'scheduled';

type ReportPeriod = {
    readonly from: Date;
    readonly to: Date;
};

type ReportUser = Pick<
    UserDb,
    | 'email'
    | 'id'
    | 'monthlyEmailReportEnabled'
    | 'timezone'
    | 'weeklyEmailReportEnabled'
>;

type ReportSendOutcome = {
    readonly type: EmailReportType;
    readonly budgetId: number;
    readonly status: 'sent' | 'skipped';
    readonly from: Date;
    readonly to: Date;
    readonly reason?: string;
};

type ReportInsight = {
    readonly title: string;
    readonly body: string;
    readonly evidence: readonly string[];
};

type ReportInsights = {
    readonly headline: string;
    readonly recap: string;
    readonly insights: readonly ReportInsight[];
    readonly actions: readonly string[];
};

type CategorySummary = {
    readonly name: string;
    readonly kind: 'normal' | 'offset';
    readonly type: 'expense' | 'income';
    readonly total: number;
    readonly share: number;
    readonly previousPeriodTotal: number;
    readonly change: number;
    readonly transactionCount: number;
};

type VendorSummary = {
    readonly name: string;
    readonly domain?: string;
    readonly description?: string;
    readonly expenseTotal: number;
    readonly shareOfExpenses: number;
    readonly transactionCount: number;
    readonly topCategories: readonly string[];
};

type NotableTransaction = {
    readonly amount: number;
    readonly categoryImpact: number;
    readonly categoryKind: 'normal' | 'offset';
    readonly categoryName: string;
    readonly date: string;
    readonly interpretation: string;
    readonly netImpact: number;
    readonly note?: string;
    readonly type: 'expense' | 'income';
    readonly vendorDomain?: string;
    readonly vendorName?: string;
};

type NotedTransaction = NotableTransaction & {
    readonly note: string;
};

type ReportAnalytics = {
    readonly type: EmailReportType;
    readonly budgetId: number;
    readonly budgetName: string;
    readonly period: ReportPeriod;
    readonly periodLabel: string;
    readonly currency: string;
    readonly incomeTotal: number;
    readonly expenseTotal: number;
    readonly netTotal: number;
    readonly savingsRate: number;
    readonly transactionCount: number;
    readonly averageIncome: number;
    readonly averageExpense: number;
    readonly previousPeriod: {
        readonly incomeTotal: number;
        readonly expenseTotal: number;
        readonly netTotal: number;
        readonly transactionCount: number;
    };
    readonly topExpenseCategories: readonly CategorySummary[];
    readonly topIncomeCategories: readonly CategorySummary[];
    readonly vendors: readonly VendorSummary[];
    readonly trend: readonly {
        readonly label: string;
        readonly incomeTotal: number;
        readonly expenseTotal: number;
        readonly netTotal: number;
        readonly transactionCount: number;
    }[];
    readonly notableTransactions: readonly NotableTransaction[];
    readonly notedTransactions: readonly NotedTransaction[];
};

export class EmailReportConfigError extends Error {}

const notedTransactionLimit = 10;

function localParts(value: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
        month: '2-digit',
        timeZone,
        weekday: 'short',
        year: 'numeric'
    }).formatToParts(value);

    return Object.fromEntries(
        parts
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, part.value])
    ) as Record<string, string>;
}

export function emailReportPeriod(
    type: EmailReportType,
    now: Date,
    timeZone: string
): ReportPeriod {
    if (type === 'weekly') {
        const currentWeek = localStartOfWeek(now, timeZone);
        return {
            from: addLocalDays(currentWeek, -7, timeZone),
            to: new Date(currentWeek.getTime() - 1)
        };
    }

    const currentMonth = localStartOfMonth(now, timeZone);
    return {
        from: localStartOfMonth(
            addLocalMonths(currentMonth, -1, timeZone),
            timeZone
        ),
        to: new Date(currentMonth.getTime() - 1)
    };
}

export function dueEmailReportTypes(
    user: Pick<
        ReportUser,
        'monthlyEmailReportEnabled' | 'timezone' | 'weeklyEmailReportEnabled'
    >,
    now: Date,
    deliveryHourLocal: number
): EmailReportType[] {
    const parts = localParts(now, user.timezone);
    const hour = Number(parts.hour);
    if (!Number.isFinite(hour) || hour < deliveryHourLocal) {
        return [];
    }

    const due: EmailReportType[] = [];
    if (user.weeklyEmailReportEnabled && parts.weekday === 'Mon') {
        due.push('weekly');
    }
    if (user.monthlyEmailReportEnabled && parts.day === '01') {
        due.push('monthly');
    }
    return due;
}

function money(value: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
        currency,
        maximumFractionDigits: 2,
        style: 'currency'
    }).format(value);
}

function percent(value: number): string {
    return `${value.toFixed(1)}%`;
}

function periodLabel(period: ReportPeriod, timeZone: string): string {
    const options = {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    } satisfies Intl.DateTimeFormatOptions;
    const formatter = new Intl.DateTimeFormat('en-US', {
        ...options,
        timeZone
    });
    return `${formatter.format(period.from)} - ${formatter.format(period.to)}`;
}

function categorySummary(
    category: StatsOverview['byCategory'][number]
): CategorySummary {
    return {
        name: category.categoryDisplayName,
        kind: category.categoryKind,
        type: category.type,
        total: category.total,
        share: category.share,
        previousPeriodTotal: category.previousPeriodTotal,
        change: category.total - category.previousPeriodTotal,
        transactionCount: category.transactionCount
    };
}

function transactionNetImpact(
    transaction: Pick<
        TransactionDb,
        'category' | 'defaultCurrencyAmount' | 'type'
    >,
    category?: CategoryDb
): number {
    const categoryImpact = transactionSignedDefaultAmount(transaction);
    return categoryReportingType(
        category ?? transaction.category,
        transaction.type
    ) === 'income'
        ? categoryImpact
        : -categoryImpact;
}

function transactionInterpretation(
    transaction: Pick<TransactionDb, 'category' | 'type'>,
    category?: CategoryDb
): string {
    const kind =
        (category ?? transaction.category)?.kind === 'offset'
            ? 'offset'
            : 'normal';
    const type = categoryReportingType(
        category ?? transaction.category,
        transaction.type
    );
    if (kind === 'normal' && type === 'expense') {
        return 'Expense spending. It increases expenses and reduces net position.';
    }
    if (kind === 'normal' && type === 'income') {
        return 'Income received. It increases income and improves net position.';
    }
    if (type === 'income') {
        return 'Return or refund category. It counts as income and improves net position; do not describe it as new spending.';
    }
    return 'Income offset category. It counts as an expense and reduces net position; treat it like an income correction.';
}

function transactionNote(transaction: Pick<TransactionDb, 'note'>) {
    const note = transaction.note?.trim();
    return note ? note : undefined;
}

function vendorDisplayName(vendor: VendorDb): string {
    return vendor.name;
}

function notableTransaction(
    transaction: TransactionDb,
    timeZone: string,
    categoriesById: ReadonlyMap<number, CategoryDb>,
    vendorsById: ReadonlyMap<number, VendorDb>
): NotableTransaction {
    const category =
        categoriesById.get(transaction.categoryId) ??
        transaction.category ??
        undefined;
    const note = transactionNote(transaction);
    const vendor = transaction.vendorId
        ? vendorsById.get(transaction.vendorId)
        : undefined;

    return {
        amount: Math.abs(Number(transaction.defaultCurrencyAmount)),
        categoryImpact: transactionSignedDefaultAmount(transaction),
        categoryKind: category?.kind === 'offset' ? 'offset' : 'normal',
        categoryName: category
            ? categoryDisplayName(category, categoriesById)
            : '',
        date: dateToLocalDateParam(transaction.occurredAt, timeZone),
        interpretation: transactionInterpretation(transaction, category),
        netImpact: transactionNetImpact(transaction, category),
        ...(note ? { note } : {}),
        type: categoryReportingType(category, transaction.type),
        ...(vendor
            ? {
                  vendorName: vendorDisplayName(vendor),
                  ...(vendor.domain ? { vendorDomain: vendor.domain } : {})
              }
            : {})
    };
}

function isNotedTransaction(
    transaction: NotableTransaction
): transaction is NotedTransaction {
    return typeof transaction.note === 'string';
}

function compareTransactionsByImpactDesc(
    left: TransactionDb,
    right: TransactionDb
) {
    return (
        Math.abs(transactionSignedDefaultAmount(right)) -
            Math.abs(transactionSignedDefaultAmount(left)) ||
        right.occurredAt.getTime() - left.occurredAt.getTime()
    );
}

export function notedTransactionsForReport(
    transactions: readonly TransactionDb[],
    timeZone: string,
    categoriesById: ReadonlyMap<number, CategoryDb>,
    vendorsById: ReadonlyMap<number, VendorDb> = new Map()
): readonly NotedTransaction[] {
    return [...transactions]
        .sort(compareTransactionsByImpactDesc)
        .filter(transaction => transactionNote(transaction))
        .slice(0, notedTransactionLimit)
        .map(transaction =>
            notableTransaction(
                transaction,
                timeZone,
                categoriesById,
                vendorsById
            )
        )
        .filter(isNotedTransaction);
}

function vendorSummariesForReport(
    transactions: readonly TransactionDb[],
    categoriesById: ReadonlyMap<number, CategoryDb>,
    vendorsById: ReadonlyMap<number, VendorDb>,
    expenseTotal: number
): readonly VendorSummary[] {
    const byVendor = new Map<
        number,
        {
            readonly vendor: VendorDb;
            expenseTotal: number;
            transactionCount: number;
            categoryTotals: Map<string, number>;
        }
    >();

    for (const transaction of transactions) {
        if (!transaction.vendorId) {
            continue;
        }
        const vendor = vendorsById.get(transaction.vendorId);
        if (!vendor) {
            continue;
        }
        const category =
            categoriesById.get(transaction.categoryId) ??
            transaction.category ??
            undefined;
        if (categoryReportingType(category, transaction.type) !== 'expense') {
            continue;
        }

        const current = byVendor.get(vendor.id) ?? {
            vendor,
            expenseTotal: 0,
            transactionCount: 0,
            categoryTotals: new Map<string, number>()
        };
        const amount = transactionSignedDefaultAmount(transaction, category);
        const categoryName = category
            ? categoryDisplayName(category, categoriesById)
            : '';

        current.expenseTotal += amount;
        current.transactionCount += 1;
        if (categoryName) {
            current.categoryTotals.set(
                categoryName,
                (current.categoryTotals.get(categoryName) ?? 0) + amount
            );
        }
        byVendor.set(vendor.id, current);
    }

    const expenseBasis = Math.abs(expenseTotal);
    return [...byVendor.values()]
        .map(summary => ({
            name: vendorDisplayName(summary.vendor),
            ...(summary.vendor.domain ? { domain: summary.vendor.domain } : {}),
            ...(summary.vendor.description
                ? { description: summary.vendor.description }
                : {}),
            expenseTotal: summary.expenseTotal,
            shareOfExpenses:
                expenseBasis > 0
                    ? (Math.abs(summary.expenseTotal) / expenseBasis) * 100
                    : 0,
            transactionCount: summary.transactionCount,
            topCategories: [...summary.categoryTotals.entries()]
                .sort(
                    ([leftName, leftTotal], [rightName, rightTotal]) =>
                        rightTotal - leftTotal ||
                        leftName.localeCompare(rightName)
                )
                .slice(0, 5)
                .map(([name]) => name)
        }))
        .sort(
            (left, right) =>
                right.expenseTotal - left.expenseTotal ||
                left.name.localeCompare(right.name)
        );
}

async function transactionsForPeriod(
    db: AppDb,
    budgetId: number,
    period: ReportPeriod
): Promise<TransactionDb[]> {
    return (await db.transactions
        .include(transaction => transaction.category)
        .where(transaction => transaction.budgetId, budgetId)
        .whereBetween(
            transaction => transaction.occurredAt,
            [period.from, period.to]
        )) as TransactionDb[];
}

async function categoriesForBudget(
    db: AppDb,
    budgetId: number
): Promise<Map<number, CategoryDb>> {
    const categories = (await db.categories.where(
        category => category.budgetId,
        budgetId
    )) as CategoryDb[];

    return new Map(
        categories.map(category => [category.id, category] as const)
    );
}

async function vendorsForBudget(
    db: AppDb,
    budgetId: number
): Promise<Map<number, VendorDb>> {
    const vendors = (await db.vendors.where(
        vendor => vendor.budgetId,
        budgetId
    )) as VendorDb[];

    return new Map(vendors.map(vendor => [vendor.id, vendor] as const));
}

async function buildReportAnalytics(
    db: AppDb,
    user: ReportUser,
    budget: Pick<BudgetDb, 'id' | 'name'>,
    type: EmailReportType,
    period: ReportPeriod
): Promise<ReportAnalytics | undefined> {
    const [overview, transactions, categoriesById, vendorsById] =
        await Promise.all([
            statsOverview(db, user.id, {
                date: period.from,
                groupBy: type === 'weekly' ? 'day' : 'week',
                period: type === 'weekly' ? 'week' : 'month',
                timeframe: 'custom',
                budgetId: budget.id
            }),
            transactionsForPeriod(db, budget.id, period),
            categoriesForBudget(db, budget.id),
            vendorsForBudget(db, budget.id)
        ]);

    if (overview.transactionCount === 0) {
        return undefined;
    }

    const topExpenseCategories = overview.byCategory
        .filter(category => category.type === 'expense')
        .sort((left, right) => right.total - left.total)
        .slice(0, 5)
        .map(categorySummary);
    const topIncomeCategories = overview.byCategory
        .filter(category => category.type === 'income')
        .sort((left, right) => right.total - left.total)
        .slice(0, 5)
        .map(categorySummary);
    const sortedTransactions = [...transactions].sort(
        compareTransactionsByImpactDesc
    );
    const notableTransactions = sortedTransactions
        .slice(0, 5)
        .map(transaction =>
            notableTransaction(
                transaction,
                user.timezone,
                categoriesById,
                vendorsById
            )
        );
    const notedTransactions = notedTransactionsForReport(
        transactions,
        user.timezone,
        categoriesById,
        vendorsById
    );
    const vendors = vendorSummariesForReport(
        transactions,
        categoriesById,
        vendorsById,
        overview.expenseTotal
    );

    return {
        type,
        budgetId: budget.id,
        budgetName: budget.name,
        period,
        periodLabel: periodLabel(period, user.timezone),
        currency: overview.currency,
        incomeTotal: overview.incomeTotal,
        expenseTotal: overview.expenseTotal,
        netTotal: overview.netTotal,
        savingsRate: overview.savingsRate,
        transactionCount: overview.transactionCount,
        averageIncome: overview.averageIncome,
        averageExpense: overview.averageExpense,
        previousPeriod: {
            incomeTotal: overview.comparison.previousPeriod.incomeTotal,
            expenseTotal: overview.comparison.previousPeriod.expenseTotal,
            netTotal: overview.comparison.previousPeriod.netTotal,
            transactionCount:
                overview.comparison.previousPeriod.transactionCount
        },
        topExpenseCategories,
        topIncomeCategories,
        vendors,
        trend: overview.trend.map(point => ({
            label: point.label,
            incomeTotal: point.incomeTotal,
            expenseTotal: point.expenseTotal,
            netTotal: point.netTotal,
            transactionCount: point.transactionCount
        })),
        notableTransactions,
        notedTransactions
    };
}

function requireReportConfig(config: Config): void {
    if (!config.emailReports.enabled) {
        throw new EmailReportConfigError('Email reports are disabled.');
    }
}

export function emailReportOpenAiPayload(analytics: ReportAnalytics) {
    return {
        report: {
            type: analytics.type,
            period: analytics.periodLabel,
            currency: analytics.currency,
            budget: {
                id: analytics.budgetId,
                name: analytics.budgetName
            },
            dataSemantics: {
                totals: 'Income, expenses, category totals, trends, and averages use each category reporting side.',
                categoryKinds: {
                    normal: 'A normal expense is spending; a normal income is received income.',
                    offset: 'An offset child category reports on the opposite side of its parent. Expense-parent offsets are income returns, refunds, or credits. Income-parent offsets are expense corrections.'
                },
                notableTransactionFields:
                    'amount is the positive magnitude; categoryImpact is the positive contribution to the reported income or expense category; netImpact is the signed impact on net position.',
                notes: 'Transaction notes are user-provided context. Use them when relevant, but do not invent vendors, purposes, or details beyond the note text.',
                vendors:
                    'Vendors include only linked expense transactions in this budget and report period. Unlinked transactions are absent from vendor summaries. Vendor names, domains, and descriptions come from budget records and enrichment data when available.'
            },
            totals: {
                income: analytics.incomeTotal,
                expenses: analytics.expenseTotal,
                net: analytics.netTotal,
                savingsRate: analytics.savingsRate,
                transactions: analytics.transactionCount,
                averageIncome: analytics.averageIncome,
                averageExpense: analytics.averageExpense
            },
            previousPeriod: analytics.previousPeriod,
            topExpenseCategories: analytics.topExpenseCategories,
            topIncomeCategories: analytics.topIncomeCategories,
            vendors: analytics.vendors,
            trend: analytics.trend,
            notableTransactions: analytics.notableTransactions,
            notedTransactions: analytics.notedTransactions
        }
    };
}

function parseInsights(value: string): ReportInsights {
    const parsed = JSON.parse(value) as Partial<ReportInsights>;
    if (
        typeof parsed.headline !== 'string' ||
        typeof parsed.recap !== 'string' ||
        !Array.isArray(parsed.insights)
    ) {
        throw new Error('OpenAI response did not match the report schema.');
    }

    return {
        headline: parsed.headline,
        recap: parsed.recap,
        insights: parsed.insights
            .filter(
                (insight): insight is ReportInsight =>
                    typeof insight === 'object' &&
                    insight !== null &&
                    typeof insight.title === 'string' &&
                    typeof insight.body === 'string' &&
                    Array.isArray(insight.evidence)
            )
            .slice(0, 5),
        actions: Array.isArray(parsed.actions)
            ? parsed.actions
                  .filter(
                      (action): action is string => typeof action === 'string'
                  )
                  .slice(0, 3)
            : []
    };
}

async function generateInsights(
    config: Config,
    analytics: ReportAnalytics
): Promise<ReportInsights> {
    const parsed = await generateStructuredJson<Partial<ReportInsights>>(
        config,
        {
            input: emailReportOpenAiPayload(analytics),
            model: config.openai.reportModel,
            schema: {
                additionalProperties: false,
                properties: {
                    headline: { type: 'string' },
                    recap: { type: 'string' },
                    insights: {
                        items: {
                            additionalProperties: false,
                            properties: {
                                title: { type: 'string' },
                                body: { type: 'string' },
                                evidence: {
                                    items: { type: 'string' },
                                    type: 'array'
                                }
                            },
                            required: ['title', 'body', 'evidence'],
                            type: 'object'
                        },
                        type: 'array'
                    },
                    actions: {
                        items: { type: 'string' },
                        type: 'array'
                    }
                },
                required: ['headline', 'recap', 'insights', 'actions'],
                type: 'object'
            },
            schemaName: 'email_report_insights',
            system: [
                'You write concise personal finance report insights. Be specific, balanced, and practical.',
                'Use only the provided aggregate data. Do not invent numbers, vendors, or facts.',
                'Use vendor summaries and notable transaction vendor fields when they add concrete insight, but do not infer vendors for unlinked transactions.',
                'Transaction notes are user-provided context. Use notes only when relevant, and do not infer details beyond the note text.',
                'Treat offset categories carefully: an expense-parent offset is a return, refund, or credit counted as income. An income-parent offset is a correction counted as expense.',
                'When notableTransactions include categoryKind=offset or interpretation text, describe them using that interpretation and do not call income-side returns new spending.'
            ].join(' ')
        }
    );
    return parseInsights(JSON.stringify(parsed));
}

function reportSubject(analytics: ReportAnalytics, insights: ReportInsights) {
    const cadence = analytics.type === 'weekly' ? 'Weekly' : 'Monthly';
    return `${cadence} xpenser report for ${analytics.budgetName}: ${insights.headline}`;
}

function statsUrl(
    config: Config,
    analytics: ReportAnalytics,
    timeZone: string
) {
    const url = new URL('/stats', config.app.url);
    url.searchParams.set(
        'period',
        analytics.type === 'weekly' ? 'week' : 'month'
    );
    url.searchParams.set(
        'date',
        dateToLocalDateParam(analytics.period.from, timeZone)
    );
    url.searchParams.set('budgetId', String(analytics.budgetId));
    return url.toString();
}

function settingsUrl(config: Config) {
    return new URL('/settings/preferences', config.app.url).toString();
}

function emailText(
    config: Config,
    user: ReportUser,
    analytics: ReportAnalytics,
    insights: ReportInsights
) {
    const lines = [
        insights.headline,
        '',
        `${analytics.type === 'weekly' ? 'Weekly' : 'Monthly'} report for ${analytics.periodLabel}`,
        `Budget: ${analytics.budgetName}`,
        insights.recap,
        '',
        `Income: ${money(analytics.incomeTotal, analytics.currency)}`,
        `Expenses: ${money(analytics.expenseTotal, analytics.currency)}`,
        `Net: ${money(analytics.netTotal, analytics.currency)}`,
        `Savings rate: ${percent(analytics.savingsRate)}`,
        '',
        'Insights:'
    ];

    for (const insight of insights.insights) {
        lines.push(`- ${insight.title}: ${insight.body}`);
        for (const evidence of insight.evidence) {
            lines.push(`  ${evidence}`);
        }
    }

    if (insights.actions.length > 0) {
        lines.push('', 'Actions:');
        for (const action of insights.actions) {
            lines.push(`- ${action}`);
        }
    }

    lines.push('', `View stats: ${statsUrl(config, analytics, user.timezone)}`);
    lines.push(`Manage reports: ${settingsUrl(config)}`);
    return lines.join('\n');
}

function htmlEscape(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function emailHtml(
    config: Config,
    user: ReportUser,
    analytics: ReportAnalytics,
    insights: ReportInsights
) {
    const summaryRows = [
        ['Income', money(analytics.incomeTotal, analytics.currency)],
        ['Expenses', money(analytics.expenseTotal, analytics.currency)],
        ['Net', money(analytics.netTotal, analytics.currency)],
        ['Savings rate', percent(analytics.savingsRate)],
        ['Transactions', String(analytics.transactionCount)]
    ];
    const summary = summaryRows
        .map(
            ([label, value]) =>
                `<tr><td style="padding:6px 0;color:#64748b;">${label}</td><td style="padding:6px 0;text-align:right;font-weight:600;">${value}</td></tr>`
        )
        .join('');
    const insightHtml = insights.insights
        .map(
            insight => `<li style="margin:0 0 16px;">
                <strong>${htmlEscape(insight.title)}</strong><br/>
                ${htmlEscape(insight.body)}
                ${
                    insight.evidence.length > 0
                        ? `<ul style="margin:8px 0 0;padding-left:18px;color:#475569;">${insight.evidence
                              .map(item => `<li>${htmlEscape(item)}</li>`)
                              .join('')}</ul>`
                        : ''
                }
            </li>`
        )
        .join('');
    const actionHtml =
        insights.actions.length > 0
            ? `<h3 style="margin:24px 0 8px;">Actions</h3><ul>${insights.actions
                  .map(action => `<li>${htmlEscape(action)}</li>`)
                  .join('')}</ul>`
            : '';

    return `
        <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;line-height:1.5;">
            <p style="color:#64748b;margin:0 0 8px;">${analytics.type === 'weekly' ? 'Weekly' : 'Monthly'} report for ${analytics.periodLabel}</p>
            <p style="color:#64748b;margin:0 0 8px;">Budget: ${htmlEscape(analytics.budgetName)}</p>
            <h1 style="font-size:24px;line-height:1.2;margin:0 0 12px;">${htmlEscape(insights.headline)}</h1>
            <p>${htmlEscape(insights.recap)}</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
                ${summary}
            </table>
            <h2 style="font-size:18px;margin:24px 0 12px;">Insights</h2>
            <ul style="padding-left:20px;margin:0;">${insightHtml}</ul>
            ${actionHtml}
            <p style="margin:28px 0 0;">
                <a href="${statsUrl(config, analytics, user.timezone)}" style="color:#2563eb;">View stats</a>
                &nbsp;|&nbsp;
                <a href="${settingsUrl(config)}" style="color:#2563eb;">Manage email reports</a>
            </p>
        </div>
    `;
}

async function sendReportEmail(
    config: Config,
    user: ReportUser,
    analytics: ReportAnalytics,
    insights: ReportInsights
): Promise<string | undefined> {
    return sendProviderEmail(config, {
        html: emailHtml(config, user, analytics, insights),
        subject: reportSubject(analytics, insights),
        text: emailText(config, user, analytics, insights),
        to: user.email
    });
}

function scheduledDeliveryKey(
    userId: number,
    budgetId: number,
    type: EmailReportType,
    period: ReportPeriod
): string {
    return `${userId}:${budgetId}:${type}:${period.from.toISOString()}`;
}

async function claimDelivery(
    knex: Knex,
    config: Config,
    user: ReportUser,
    budget: Pick<BudgetDb, 'id'>,
    type: EmailReportType,
    trigger: ReportTrigger,
    period: ReportPeriod
): Promise<number | undefined> {
    const deliveryKey = scheduledDeliveryKey(user.id, budget.id, type, period);
    const tableName = getTableName(EmailReportDeliveryDbSchema);
    const result = await schemaQuery(knex, EmailReportDeliveryDbSchema)
        .onConflict(delivery => delivery.deliveryKey)
        .merge(
            {
                userId: user.id,
                budgetId: budget.id,
                deliveryKey,
                reportType: type,
                trigger,
                periodStart: period.from,
                periodEnd: period.to,
                recipientEmail: user.email,
                status: 'pending',
                attempts: 1,
                lastError: undefined,
                providerMessageId: undefined,
                sentAt: undefined
            },
            {
                status: 'pending',
                attempts: ({ column, raw }) =>
                    raw('??.?? + 1', [
                        tableName,
                        column(delivery => delivery.attempts)
                    ]),
                lastError: ({
                    raw
                }: {
                    readonly raw: (
                        sql: string,
                        bindings?: readonly unknown[]
                    ) => Knex.Raw;
                }) => raw('null'),
                updatedAt: ({ knex }) => knex.fn.now()
            },
            {
                where: (builder, { column }) => {
                    builder
                        .where(
                            column(delivery => delivery.status),
                            'failed'
                        )
                        .where(
                            column(delivery => delivery.attempts),
                            '<',
                            config.emailReports.maxAttempts
                        );
                }
            }
        );

    return (result as EmailReportDeliveryDb | undefined)?.id;
}

async function markDeliverySkipped(
    knex: Knex,
    deliveryId: number
): Promise<void> {
    await schemaQuery(knex, EmailReportDeliveryDbSchema)
        .where(delivery => delivery.id, deliveryId)
        .update({ status: 'skipped', updatedAt: new Date() });
}

async function markDeliverySent(
    knex: Knex,
    deliveryId: number,
    providerMessageId: string | undefined
): Promise<void> {
    await schemaQuery(knex, EmailReportDeliveryDbSchema)
        .where(delivery => delivery.id, deliveryId)
        .update({
            providerMessageId,
            sentAt: new Date(),
            status: 'sent',
            updatedAt: new Date()
        });
}

async function markDeliveryFailed(
    knex: Knex,
    deliveryId: number,
    err: unknown
): Promise<void> {
    await schemaQuery(knex, EmailReportDeliveryDbSchema)
        .where(delivery => delivery.id, deliveryId)
        .update({
            lastError: err instanceof Error ? err.message : String(err),
            status: 'failed',
            updatedAt: new Date()
        });
}

async function sendEmailReport(
    db: AppDb,
    knex: Knex,
    config: Config,
    user: ReportUser,
    budget: Pick<BudgetDb, 'id' | 'name'>,
    type: EmailReportType,
    trigger: ReportTrigger,
    now: Date
): Promise<ReportSendOutcome> {
    requireReportConfig(config);
    const period = emailReportPeriod(type, now, user.timezone);
    const deliveryId = await claimDelivery(
        knex,
        config,
        user,
        budget,
        type,
        trigger,
        period
    );
    if (!deliveryId) {
        return {
            type,
            budgetId: budget.id,
            status: 'skipped',
            from: period.from,
            to: period.to,
            reason: 'already delivered or pending'
        };
    }

    try {
        const analytics = await buildReportAnalytics(
            db,
            user,
            budget,
            type,
            period
        );
        if (!analytics) {
            await markDeliverySkipped(knex, deliveryId);
            return {
                type,
                budgetId: budget.id,
                status: 'skipped',
                from: period.from,
                to: period.to,
                reason: 'no transactions in the reporting period'
            };
        }

        const insights = await generateInsights(config, analytics);
        const messageId = await sendReportEmail(
            config,
            user,
            analytics,
            insights
        );
        await markDeliverySent(knex, deliveryId, messageId);
        return {
            type,
            budgetId: budget.id,
            status: 'sent',
            from: period.from,
            to: period.to
        };
    } catch (err) {
        await markDeliveryFailed(knex, deliveryId, err);
        throw err;
    }
}

async function listReportUsers(knex: Knex): Promise<ReportUser[]> {
    const rows = await schemaQuery(knex, UserDbSchema)
        .select(user => ({
            id: user.id,
            email: user.email,
            timezone: user.timezone,
            weeklyEmailReportEnabled: user.weeklyEmailReportEnabled,
            monthlyEmailReportEnabled: user.monthlyEmailReportEnabled
        }))
        .where(user => user.weeklyEmailReportEnabled, true)
        .orWhere(user => user.monthlyEmailReportEnabled, true);

    return rows as ReportUser[];
}

async function listReportBudgets(
    knex: Knex,
    userId: number
): Promise<Pick<BudgetDb, 'id' | 'name'>[]> {
    const activeBudgets = schemaQuery(knex, BudgetDbSchema).whereNull(
        budget => budget.archivedAt
    );
    const rows = await schemaQuery(knex, BudgetMemberDbSchema)
        .where(member => member.userId, userId)
        .orderBy(member => member.displayName, 'asc')
        .joinOne({
            as: 'budget',
            localColumn: member => member.budgetId,
            foreignColumn: budget => budget.id,
            foreignSchema: BudgetDbSchema,
            foreignQuery: activeBudgets,
            required: true
        });

    return (rows as Array<BudgetMemberDb & { readonly budget: BudgetDb }>).map(
        row => ({ id: row.budget.id, name: row.displayName })
    );
}

export async function sendDueEmailReports(
    db: AppDb,
    knex: Knex,
    config: Config,
    logger: Logger,
    now = new Date()
): Promise<void> {
    if (!config.emailReports.enabled || !config.emailReports.schedulerEnabled) {
        return;
    }

    const users = await listReportUsers(knex);
    for (const user of users) {
        const types = dueEmailReportTypes(
            user,
            now,
            config.emailReports.deliveryHourLocal
        );
        const budgets = await listReportBudgets(knex, user.id);
        for (const type of types) {
            for (const budget of budgets) {
                try {
                    await sendEmailReport(
                        db,
                        knex,
                        config,
                        user,
                        budget,
                        type,
                        'scheduled',
                        now
                    );
                } catch (err) {
                    logger.error('Email report delivery failed', {
                        BudgetId: budget.id,
                        Error: err instanceof Error ? err.message : String(err),
                        ReportType: type,
                        UserId: user.id
                    });
                }
            }
        }
    }
}
