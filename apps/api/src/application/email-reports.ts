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
import type { AppDb, TransactionDb, UserDb } from '../db/schemas.js';
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
    | 'defaultCurrency'
    | 'email'
    | 'id'
    | 'monthlyEmailReportEnabled'
    | 'timezone'
    | 'weeklyEmailReportEnabled'
>;

type ReportSendOutcome = {
    readonly type: EmailReportType;
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
    readonly type: 'expense' | 'income';
    readonly total: number;
    readonly share: number;
    readonly previousPeriodTotal: number;
    readonly change: number;
    readonly transactionCount: number;
};

type NotableTransaction = {
    readonly amount: number;
    readonly categoryImpact: number;
    readonly categoryName: string;
    readonly date: string;
    readonly effect: 'normal' | 'reversal';
    readonly interpretation: string;
    readonly netImpact: number;
    readonly type: 'expense' | 'income';
};

type ReportAnalytics = {
    readonly type: EmailReportType;
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
    readonly trend: readonly {
        readonly label: string;
        readonly incomeTotal: number;
        readonly expenseTotal: number;
        readonly netTotal: number;
        readonly transactionCount: number;
    }[];
    readonly notableTransactions: readonly NotableTransaction[];
};

export class EmailReportConfigError extends Error {}

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
        name: category.categoryName,
        type: category.type,
        total: category.total,
        share: category.share,
        previousPeriodTotal: category.previousPeriodTotal,
        change: category.total - category.previousPeriodTotal,
        transactionCount: category.transactionCount
    };
}

function transactionEffect(
    transaction: Pick<TransactionDb, 'effect'>
): 'normal' | 'reversal' {
    return transaction.effect === 'reversal' ? 'reversal' : 'normal';
}

function transactionNetImpact(
    transaction: Pick<
        TransactionDb,
        'defaultCurrencyAmount' | 'effect' | 'type'
    >
): number {
    const categoryImpact = transactionSignedDefaultAmount(transaction);
    return transaction.type === 'income' ? categoryImpact : -categoryImpact;
}

function transactionInterpretation(
    transaction: Pick<TransactionDb, 'effect' | 'type'>
): string {
    const effect = transactionEffect(transaction);
    if (effect === 'normal' && transaction.type === 'expense') {
        return 'Expense spending. It increases expenses and reduces net position.';
    }
    if (effect === 'normal' && transaction.type === 'income') {
        return 'Income received. It increases income and improves net position.';
    }
    if (transaction.type === 'expense') {
        return 'Expense reversal/refund. It reduces expenses and improves net position; do not describe it as spending.';
    }
    return 'Income reversal/correction. It reduces income and lowers net position; do not describe it as spending.';
}

function notableTransaction(
    transaction: TransactionDb,
    timeZone: string
): NotableTransaction {
    return {
        amount: Math.abs(Number(transaction.defaultCurrencyAmount)),
        categoryImpact: transactionSignedDefaultAmount(transaction),
        categoryName: transaction.category?.name ?? '',
        date: dateToLocalDateParam(transaction.occurredAt, timeZone),
        effect: transactionEffect(transaction),
        interpretation: transactionInterpretation(transaction),
        netImpact: transactionNetImpact(transaction),
        type: transaction.type
    };
}

async function transactionsForPeriod(
    db: AppDb,
    userId: number,
    period: ReportPeriod
): Promise<TransactionDb[]> {
    return (await db.transactions
        .include(transaction => transaction.category)
        .where(transaction => transaction.userId, userId)
        .whereBetween(
            transaction => transaction.occurredAt,
            [period.from, period.to]
        )) as TransactionDb[];
}

async function buildReportAnalytics(
    db: AppDb,
    user: ReportUser,
    type: EmailReportType,
    period: ReportPeriod
): Promise<ReportAnalytics | undefined> {
    const [overview, transactions] = await Promise.all([
        statsOverview(db, user.id, {
            date: period.from,
            groupBy: type === 'weekly' ? 'day' : 'week',
            period: type === 'weekly' ? 'week' : 'month',
            timeframe: 'custom'
        }),
        transactionsForPeriod(db, user.id, period)
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
    const notableTransactions = [...transactions]
        .sort(
            (left, right) =>
                Math.abs(transactionSignedDefaultAmount(right)) -
                    Math.abs(transactionSignedDefaultAmount(left)) ||
                right.occurredAt.getTime() - left.occurredAt.getTime()
        )
        .slice(0, 5)
        .map(transaction => notableTransaction(transaction, user.timezone));

    return {
        type,
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
        trend: overview.trend.map(point => ({
            label: point.label,
            incomeTotal: point.incomeTotal,
            expenseTotal: point.expenseTotal,
            netTotal: point.netTotal,
            transactionCount: point.transactionCount
        })),
        notableTransactions
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
            dataSemantics: {
                totals: 'Income, expenses, category totals, trends, and averages are net of reversal transactions.',
                transactionEffects: {
                    normal: 'A normal expense is spending; a normal income is received income.',
                    reversal:
                        'A reversal cancels or offsets a prior transaction. Expense reversals are refunds/credits that reduce expenses and improve net position. Income reversals reduce income. Do not describe reversals as new spending.'
                },
                notableTransactionFields:
                    'amount is the positive magnitude; categoryImpact is the signed contribution to its income or expense category; netImpact is the signed impact on net position.'
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
            trend: analytics.trend,
            notableTransactions: analytics.notableTransactions
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
                'Use only the provided aggregate data. Do not invent numbers, merchants, or facts.',
                'Treat reversal transactions carefully: an expense reversal is a refund or credit that reduces spending, not a negative purchase. An income reversal is a correction that reduces income, not spending.',
                'When notableTransactions include effect=reversal or interpretation text, describe them using that interpretation and never call them new spending.'
            ].join(' ')
        }
    );
    return parseInsights(JSON.stringify(parsed));
}

function reportSubject(analytics: ReportAnalytics, insights: ReportInsights) {
    const cadence = analytics.type === 'weekly' ? 'Weekly' : 'Monthly';
    return `${cadence} xpenser report: ${insights.headline}`;
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
    type: EmailReportType,
    period: ReportPeriod
): string {
    return `${userId}:${type}:${period.from.toISOString()}`;
}

async function claimDelivery(
    knex: Knex,
    config: Config,
    user: ReportUser,
    type: EmailReportType,
    trigger: ReportTrigger,
    period: ReportPeriod
): Promise<number | undefined> {
    const deliveryKey = scheduledDeliveryKey(user.id, type, period);
    const result = await knex.raw<{ rows: { id: number }[] }>(
        `
        insert into email_report_deliveries (
            user_id,
            delivery_key,
            report_type,
            trigger,
            period_start,
            period_end,
            recipient_email,
            status,
            attempts,
            created_at,
            updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, 'pending', 1, now(), now())
        on conflict (delivery_key) do update
        set status = 'pending',
            attempts = email_report_deliveries.attempts + 1,
            last_error = null,
            updated_at = now()
        where email_report_deliveries.status = 'failed'
          and email_report_deliveries.attempts < ?
        returning id
        `,
        [
            user.id,
            deliveryKey,
            type,
            trigger,
            period.from,
            period.to,
            user.email,
            config.emailReports.maxAttempts
        ]
    );

    return result.rows[0]?.id;
}

async function markDeliverySkipped(
    knex: Knex,
    deliveryId: number
): Promise<void> {
    await knex('email_report_deliveries').where({ id: deliveryId }).update({
        status: 'skipped',
        updated_at: new Date()
    });
}

async function markDeliverySent(
    knex: Knex,
    deliveryId: number,
    providerMessageId: string | undefined
): Promise<void> {
    await knex('email_report_deliveries').where({ id: deliveryId }).update({
        provider_message_id: providerMessageId,
        sent_at: new Date(),
        status: 'sent',
        updated_at: new Date()
    });
}

async function markDeliveryFailed(
    knex: Knex,
    deliveryId: number,
    err: unknown
): Promise<void> {
    await knex('email_report_deliveries')
        .where({ id: deliveryId })
        .update({
            last_error: err instanceof Error ? err.message : String(err),
            status: 'failed',
            updated_at: new Date()
        });
}

async function sendEmailReport(
    db: AppDb,
    knex: Knex,
    config: Config,
    user: ReportUser,
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
        type,
        trigger,
        period
    );
    if (!deliveryId) {
        return {
            type,
            status: 'skipped',
            from: period.from,
            to: period.to,
            reason: 'already delivered or pending'
        };
    }

    try {
        const analytics = await buildReportAnalytics(db, user, type, period);
        if (!analytics) {
            await markDeliverySkipped(knex, deliveryId);
            return {
                type,
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
        return { type, status: 'sent', from: period.from, to: period.to };
    } catch (err) {
        await markDeliveryFailed(knex, deliveryId, err);
        throw err;
    }
}

async function listReportUsers(knex: Knex): Promise<ReportUser[]> {
    const rows = await knex('users')
        .select(
            'id',
            'email',
            'default_currency as defaultCurrency',
            'timezone',
            'weekly_email_report_enabled as weeklyEmailReportEnabled',
            'monthly_email_report_enabled as monthlyEmailReportEnabled'
        )
        .where(builder => {
            builder
                .where('weekly_email_report_enabled', true)
                .orWhere('monthly_email_report_enabled', true);
        });

    return rows as ReportUser[];
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
        for (const type of types) {
            try {
                await sendEmailReport(
                    db,
                    knex,
                    config,
                    user,
                    type,
                    'scheduled',
                    now
                );
            } catch (err) {
                logger.error('Email report delivery failed', {
                    Error: err instanceof Error ? err.message : String(err),
                    ReportType: type,
                    UserId: user.id
                });
            }
        }
    }
}
