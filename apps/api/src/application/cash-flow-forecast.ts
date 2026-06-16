import type { Logger } from '@cleverbrush/log';
import type {
    CashFlowForecastConfidence,
    CashFlowForecastInsight,
    CashFlowForecastQuery,
    CashFlowForecastResponse,
    CashFlowForecastWindow,
    CashFlowRecurringPattern
} from '@xpenser/contracts';
import {
    addLocalDays,
    addLocalMonths,
    dateToLocalDateParam,
    formatDateInTimeZone,
    localDayDifference,
    localEndOfDay,
    localStartOfDay
} from '@xpenser/timezone';
import type { Config } from '../config.js';
import type {
    AppDb,
    CategoryDb,
    TransactionDb,
    UserDb,
    VendorDb
} from '../db/schemas.js';
import { categoryDisplayName, categoryReportingType } from './categories.js';
import { generateStructuredJson, OpenAIConfigError } from './openai.js';

type ForecastType = 'expense' | 'income';
type ForecastUser = Pick<UserDb, 'defaultCurrency' | 'id' | 'timezone'>;
type ForecastEvent = {
    readonly id: number;
    readonly amount: number;
    readonly categoryDisplayName: string;
    readonly categoryId: number;
    readonly occurredAt: Date;
    readonly patternKey?: string;
    readonly type: ForecastType;
    readonly vendorId?: number | null;
    readonly vendorName?: string;
    readonly note?: string;
};
type DetectedPattern = CashFlowRecurringPattern & {
    readonly intervalDays: number;
    readonly lastOccurredAt: Date;
    readonly patternKey: string;
};
type ProjectedOccurrence = {
    readonly amount: number;
    readonly occurredAt: Date;
    readonly patternId: string;
    readonly type: ForecastType;
};

const forecastHistoryDays = 180;
const forecastHorizons = [30, 90] as const;
const forecastInsightTimeoutMs = 3000;
const maxInsightItems = 4;

function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}

function median(values: readonly number[]): number {
    if (values.length === 0) {
        return 0;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) {
        return sorted[middle] ?? 0;
    }
    return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function average(values: readonly number[]): number {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeNote(value?: string | null): string | undefined {
    const normalized = value?.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normalized || normalized.length < 3) {
        return undefined;
    }
    return normalized.slice(0, 80);
}

function forecastPatternKey(
    type: ForecastType,
    categoryId: number,
    vendorId?: number | null,
    note?: string
): string | undefined {
    if (vendorId) {
        return `${type}:category:${categoryId}:vendor:${vendorId}`;
    }
    if (note) {
        return `${type}:category:${categoryId}:note:${note}`;
    }
    return undefined;
}

function mapForecastEvent(
    row: TransactionDb,
    categoriesById: ReadonlyMap<number, CategoryDb>,
    vendorsById: ReadonlyMap<number, VendorDb>
): ForecastEvent | undefined {
    const category = categoriesById.get(row.categoryId) ?? row.category;
    const amount = Math.abs(Number(row.defaultCurrencyAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
        return undefined;
    }

    const type = categoryReportingType(category, row.type);
    const vendor = row.vendorId ? vendorsById.get(row.vendorId) : undefined;
    const note = normalizeNote(row.note);
    const patternKey = forecastPatternKey(
        type,
        row.categoryId,
        row.vendorId,
        note
    );

    return {
        id: row.id,
        amount,
        categoryDisplayName: category
            ? categoryDisplayName(category, categoriesById)
            : '',
        categoryId: row.categoryId,
        occurredAt: row.occurredAt,
        patternKey,
        type,
        vendorId: row.vendorId ?? null,
        vendorName: vendor?.name,
        note
    };
}

function cadenceTarget(cadence: CashFlowRecurringPattern['cadence']): number {
    if (cadence === 'weekly') {
        return 7;
    }
    if (cadence === 'biweekly') {
        return 14;
    }
    return 30;
}

function cadenceTolerance(
    cadence: CashFlowRecurringPattern['cadence']
): number {
    return cadence === 'monthly' ? 5 : cadence === 'biweekly' ? 3 : 2;
}

function cadenceScore(
    intervals: readonly number[],
    cadence: CashFlowRecurringPattern['cadence']
) {
    const target = cadenceTarget(cadence);
    const tolerance = cadenceTolerance(cadence);
    const matches = intervals.filter(
        interval => Math.abs(interval - target) <= tolerance
    ).length;
    return {
        cadence,
        target,
        matchRatio: matches / Math.max(1, intervals.length),
        averageDelta: average(
            intervals.map(interval => Math.abs(interval - target))
        )
    };
}

function detectCadence(intervals: readonly number[]) {
    const candidates = (['weekly', 'biweekly', 'monthly'] as const)
        .map(cadence => cadenceScore(intervals, cadence))
        .sort(
            (left, right) =>
                right.matchRatio - left.matchRatio ||
                left.averageDelta - right.averageDelta
        );
    const best = candidates[0];
    if (!best || best.matchRatio < 0.7) {
        return undefined;
    }
    return best;
}

function confidence(
    occurrenceCount: number,
    amountDeviation: number,
    cadenceMatchRatio: number
): CashFlowForecastConfidence {
    if (
        occurrenceCount >= 4 &&
        amountDeviation <= 0.1 &&
        cadenceMatchRatio >= 0.9
    ) {
        return 'high';
    }
    if (
        occurrenceCount >= 3 &&
        amountDeviation <= 0.25 &&
        cadenceMatchRatio >= 0.7
    ) {
        return 'medium';
    }
    return 'low';
}

function nextPatternDate(
    value: Date,
    cadence: CashFlowRecurringPattern['cadence'],
    timeZone: string
): Date {
    if (cadence === 'monthly') {
        return addLocalMonths(value, 1, timeZone);
    }
    return addLocalDays(value, cadence === 'biweekly' ? 14 : 7, timeZone);
}

export function detectRecurringPatterns(
    events: readonly ForecastEvent[],
    forecastFrom: Date,
    forecastTo: Date,
    timeZone: string
): DetectedPattern[] {
    const groups = new Map<string, ForecastEvent[]>();
    for (const event of events) {
        if (!event.patternKey) {
            continue;
        }
        groups.set(event.patternKey, [
            ...(groups.get(event.patternKey) ?? []),
            event
        ]);
    }

    const patterns: DetectedPattern[] = [];
    for (const [patternKey, group] of groups) {
        const sorted = [...group].sort(
            (left, right) =>
                left.occurredAt.getTime() - right.occurredAt.getTime()
        );
        if (sorted.length < 3) {
            continue;
        }

        const intervals = sorted
            .slice(1)
            .map((event, index) =>
                localDayDifference(
                    sorted[index]?.occurredAt ?? event.occurredAt,
                    event.occurredAt,
                    timeZone
                )
            );
        const cadence = detectCadence(intervals);
        if (!cadence) {
            continue;
        }

        const amounts = sorted.map(event => event.amount);
        const amount = median(amounts);
        if (amount <= 0) {
            continue;
        }

        const relativeDeviation = average(
            amounts.map(value => Math.abs(value - amount) / amount)
        );
        if (relativeDeviation > 0.25) {
            continue;
        }

        const first = sorted[0]!;
        const last = sorted[sorted.length - 1]!;
        const daysSinceLast = localDayDifference(
            last.occurredAt,
            forecastFrom,
            timeZone
        );
        if (daysSinceLast > cadence.target * 2.5) {
            continue;
        }

        let nextOccurrence = nextPatternDate(
            last.occurredAt,
            cadence.cadence,
            timeZone
        );
        while (nextOccurrence < forecastFrom) {
            nextOccurrence = nextPatternDate(
                nextOccurrence,
                cadence.cadence,
                timeZone
            );
        }

        const projected = projectPatternOccurrences(
            {
                amount,
                cadence: cadence.cadence,
                lastOccurredAt: last.occurredAt,
                patternKey
            },
            forecastFrom,
            addLocalDays(forecastFrom, 90, timeZone),
            timeZone
        );

        patterns.push({
            id: patternKey,
            amount: roundMoney(amount),
            averageIntervalDays: roundMoney(average(intervals)),
            cadence: cadence.cadence,
            categoryDisplayName: first.categoryDisplayName,
            categoryId: first.categoryId,
            confidence: confidence(
                sorted.length,
                relativeDeviation,
                cadence.matchRatio
            ),
            intervalDays: cadence.target,
            lastOccurredAt: last.occurredAt,
            nextOccurrenceAt:
                nextOccurrence <= forecastTo ? nextOccurrence : undefined,
            note: first.vendorId ? undefined : first.note,
            occurrenceCount: sorted.length,
            patternKey,
            projectedCount: projected.length,
            projectedTotal: roundMoney(
                projected.reduce((sum, item) => sum + item.amount, 0)
            ),
            type: first.type,
            vendorId: first.vendorId ?? null,
            vendorName: first.vendorName
        });
    }

    return patterns.sort(
        (left, right) =>
            Math.abs(right.projectedTotal) - Math.abs(left.projectedTotal) ||
            left.categoryDisplayName.localeCompare(right.categoryDisplayName)
    );
}

function projectPatternOccurrences(
    pattern: Pick<
        DetectedPattern,
        'amount' | 'cadence' | 'lastOccurredAt' | 'patternKey'
    >,
    from: Date,
    toExclusive: Date,
    timeZone: string
): ProjectedOccurrence[] {
    const occurrences: ProjectedOccurrence[] = [];
    let current = nextPatternDate(
        pattern.lastOccurredAt,
        pattern.cadence,
        timeZone
    );

    while (current < from) {
        current = nextPatternDate(current, pattern.cadence, timeZone);
    }
    while (current < toExclusive) {
        const [type] = pattern.patternKey.split(':');
        occurrences.push({
            amount: pattern.amount,
            occurredAt: current,
            patternId: pattern.patternKey,
            type: type === 'income' ? 'income' : 'expense'
        });
        current = nextPatternDate(current, pattern.cadence, timeZone);
    }

    return occurrences;
}

function windowConfidence(
    transactionCount: number,
    patterns: readonly DetectedPattern[],
    horizonDays: number
): CashFlowForecastConfidence {
    if (transactionCount < 10) {
        return 'low';
    }
    if (
        horizonDays === 30 &&
        transactionCount >= 45 &&
        patterns.some(pattern => pattern.confidence === 'high')
    ) {
        return 'high';
    }
    return 'medium';
}

function bucketLabel(value: Date, timeZone: string): string {
    return formatDateInTimeZone(
        value,
        timeZone,
        { day: 'numeric', month: 'short' },
        'en-GB'
    );
}

function buildForecastWindow({
    baselineDailyExpense,
    baselineDailyIncome,
    forecastFrom,
    horizonDays,
    patterns,
    timeZone,
    transactionCount
}: {
    readonly baselineDailyExpense: number;
    readonly baselineDailyIncome: number;
    readonly forecastFrom: Date;
    readonly horizonDays: 30 | 90;
    readonly patterns: readonly DetectedPattern[];
    readonly timeZone: string;
    readonly transactionCount: number;
}): CashFlowForecastWindow {
    const toExclusive = addLocalDays(forecastFrom, horizonDays, timeZone);
    const to = new Date(toExclusive.getTime() - 1);
    const occurrences = patterns.flatMap(pattern =>
        projectPatternOccurrences(pattern, forecastFrom, toExclusive, timeZone)
    );
    const buckets: CashFlowForecastWindow['buckets'] = [];

    for (
        let bucketFrom = forecastFrom;
        bucketFrom < toExclusive;
        bucketFrom = addLocalDays(bucketFrom, 7, timeZone)
    ) {
        const bucketToExclusiveCandidate = addLocalDays(
            bucketFrom,
            7,
            timeZone
        );
        const bucketToExclusive =
            bucketToExclusiveCandidate < toExclusive
                ? bucketToExclusiveCandidate
                : toExclusive;
        const days = localDayDifference(
            bucketFrom,
            bucketToExclusive,
            timeZone
        );
        const bucketOccurrences = occurrences.filter(
            occurrence =>
                occurrence.occurredAt >= bucketFrom &&
                occurrence.occurredAt < bucketToExclusive
        );
        const recurringIncomeTotal = bucketOccurrences
            .filter(occurrence => occurrence.type === 'income')
            .reduce((sum, occurrence) => sum + occurrence.amount, 0);
        const recurringExpenseTotal = bucketOccurrences
            .filter(occurrence => occurrence.type === 'expense')
            .reduce((sum, occurrence) => sum + occurrence.amount, 0);
        const baselineIncomeTotal = baselineDailyIncome * days;
        const baselineExpenseTotal = baselineDailyExpense * days;
        const incomeTotal = baselineIncomeTotal + recurringIncomeTotal;
        const expenseTotal = baselineExpenseTotal + recurringExpenseTotal;

        buckets.push({
            from: bucketFrom,
            to: new Date(bucketToExclusive.getTime() - 1),
            label: bucketLabel(bucketFrom, timeZone),
            baselineExpenseTotal: roundMoney(baselineExpenseTotal),
            baselineIncomeTotal: roundMoney(baselineIncomeTotal),
            expenseTotal: roundMoney(expenseTotal),
            incomeTotal: roundMoney(incomeTotal),
            netTotal: roundMoney(incomeTotal - expenseTotal),
            recurringExpenseTotal: roundMoney(recurringExpenseTotal),
            recurringIncomeTotal: roundMoney(recurringIncomeTotal)
        });
    }

    const totals = buckets.reduce(
        (sum, bucket) => ({
            baselineExpenseTotal:
                sum.baselineExpenseTotal + bucket.baselineExpenseTotal,
            baselineIncomeTotal:
                sum.baselineIncomeTotal + bucket.baselineIncomeTotal,
            expenseTotal: sum.expenseTotal + bucket.expenseTotal,
            incomeTotal: sum.incomeTotal + bucket.incomeTotal,
            recurringExpenseTotal:
                sum.recurringExpenseTotal + bucket.recurringExpenseTotal,
            recurringIncomeTotal:
                sum.recurringIncomeTotal + bucket.recurringIncomeTotal
        }),
        {
            baselineExpenseTotal: 0,
            baselineIncomeTotal: 0,
            expenseTotal: 0,
            incomeTotal: 0,
            recurringExpenseTotal: 0,
            recurringIncomeTotal: 0
        }
    );
    const netTotal = totals.incomeTotal - totals.expenseTotal;

    return {
        horizonDays,
        from: forecastFrom,
        to,
        averageDailyNet: roundMoney(netTotal / horizonDays),
        baselineExpenseTotal: roundMoney(totals.baselineExpenseTotal),
        baselineIncomeTotal: roundMoney(totals.baselineIncomeTotal),
        buckets,
        confidence: windowConfidence(transactionCount, patterns, horizonDays),
        expenseTotal: roundMoney(totals.expenseTotal),
        incomeTotal: roundMoney(totals.incomeTotal),
        netTotal: roundMoney(netTotal),
        projectedRecurringCount: occurrences.length,
        recurringExpenseTotal: roundMoney(totals.recurringExpenseTotal),
        recurringIncomeTotal: roundMoney(totals.recurringIncomeTotal)
    };
}

export function buildCashFlowForecast(input: {
    readonly categories: readonly CategoryDb[];
    readonly now: Date;
    readonly query?: CashFlowForecastQuery;
    readonly transactions: readonly TransactionDb[];
    readonly user: ForecastUser;
    readonly vendors: readonly VendorDb[];
}): CashFlowForecastResponse {
    const categoriesById = new Map(
        input.categories.map(category => [category.id, category] as const)
    );
    const vendorsById = new Map(
        input.vendors.map(vendor => [vendor.id, vendor] as const)
    );
    const forecastFrom = localStartOfDay(
        input.query?.date ?? input.now,
        input.user.timezone
    );
    const historyFrom = addLocalDays(
        forecastFrom,
        -forecastHistoryDays,
        input.user.timezone
    );
    const historyTo = new Date(forecastFrom.getTime() - 1);
    const forecastTo = localEndOfDay(
        addLocalDays(forecastFrom, 89, input.user.timezone),
        input.user.timezone
    );
    const events = input.transactions
        .map(transaction =>
            mapForecastEvent(transaction, categoriesById, vendorsById)
        )
        .filter((event): event is ForecastEvent => Boolean(event));
    const patterns = detectRecurringPatterns(
        events,
        forecastFrom,
        forecastTo,
        input.user.timezone
    );
    const recurringPatternKeys = new Set(
        patterns.map(pattern => pattern.patternKey)
    );
    const nonRecurringEvents = events.filter(
        event =>
            !event.patternKey || !recurringPatternKeys.has(event.patternKey)
    );
    const baselineIncomeTotal = nonRecurringEvents
        .filter(event => event.type === 'income')
        .reduce((sum, event) => sum + event.amount, 0);
    const baselineExpenseTotal = nonRecurringEvents
        .filter(event => event.type === 'expense')
        .reduce((sum, event) => sum + event.amount, 0);
    const baselineDailyIncome = baselineIncomeTotal / forecastHistoryDays;
    const baselineDailyExpense = baselineExpenseTotal / forecastHistoryDays;
    const windows = forecastHorizons.map(horizonDays =>
        buildForecastWindow({
            baselineDailyExpense,
            baselineDailyIncome,
            forecastFrom,
            horizonDays,
            patterns,
            timeZone: input.user.timezone,
            transactionCount: events.length
        })
    );

    return {
        anchorDate: forecastFrom,
        currency: input.user.defaultCurrency,
        generatedAt: input.now,
        historyDays: forecastHistoryDays,
        historyFrom,
        historyTo,
        insightsStatus: 'unavailable',
        recurringPatterns: patterns.map(
            ({ intervalDays, lastOccurredAt, patternKey, ...pattern }) =>
                pattern
        ),
        transactionCount: events.length,
        windows
    };
}

function forecastOpenAiPayload(forecast: CashFlowForecastResponse) {
    return {
        forecast: {
            anchorDate: dateToLocalDateParam(forecast.anchorDate, 'UTC'),
            currency: forecast.currency,
            dataSemantics: {
                totals: 'All totals are deterministic projections in the user default currency.',
                baseline:
                    'Baseline income and expenses come from non-recurring historical daily averages over the completed history window.',
                recurring:
                    'Recurring patterns were detected deterministically from repeated category, vendor or note, amount stability, and weekly, biweekly, or monthly cadence.',
                limits: 'This is a cash-flow projection from recorded transactions, not a bank balance, investment forecast, or financial advice.'
            },
            history: {
                from: forecast.historyFrom,
                to: forecast.historyTo,
                days: forecast.historyDays,
                transactions: forecast.transactionCount
            },
            windows: forecast.windows.map(window => ({
                horizonDays: window.horizonDays,
                incomeTotal: window.incomeTotal,
                expenseTotal: window.expenseTotal,
                netTotal: window.netTotal,
                averageDailyNet: window.averageDailyNet,
                confidence: window.confidence,
                recurringIncomeTotal: window.recurringIncomeTotal,
                recurringExpenseTotal: window.recurringExpenseTotal,
                projectedRecurringCount: window.projectedRecurringCount
            })),
            recurringPatterns: forecast.recurringPatterns.map(pattern => ({
                type: pattern.type,
                cadence: pattern.cadence,
                amount: pattern.amount,
                category: pattern.categoryDisplayName,
                vendor: pattern.vendorName,
                note: pattern.note,
                occurrenceCount: pattern.occurrenceCount,
                projectedCount: pattern.projectedCount,
                projectedTotal: pattern.projectedTotal,
                confidence: pattern.confidence
            }))
        }
    };
}

function cleanStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value
              .filter((item): item is string => typeof item === 'string')
              .map(item => item.trim())
              .filter(Boolean)
              .slice(0, maxInsightItems)
        : [];
}

function parseForecastInsight(
    value: Partial<CashFlowForecastInsight>
): CashFlowForecastInsight {
    return {
        headline:
            typeof value.headline === 'string' && value.headline.trim()
                ? value.headline.trim()
                : 'Cash-flow forecast ready',
        summary:
            typeof value.summary === 'string' && value.summary.trim()
                ? value.summary.trim()
                : 'The forecast is based on recorded transactions and detected recurring patterns.',
        risks: cleanStringArray(value.risks),
        opportunities: cleanStringArray(value.opportunities),
        recurringNotes: cleanStringArray(value.recurringNotes),
        actions: cleanStringArray(value.actions)
    };
}

async function generateForecastInsight(
    config: Config,
    forecast: CashFlowForecastResponse
): Promise<CashFlowForecastInsight> {
    const parsed = await generateStructuredJson<
        Partial<CashFlowForecastInsight>
    >(config, {
        input: forecastOpenAiPayload(forecast),
        model: config.openai.reportModel,
        schema: {
            additionalProperties: false,
            properties: {
                headline: { type: 'string' },
                summary: { type: 'string' },
                risks: {
                    items: { type: 'string' },
                    type: 'array'
                },
                opportunities: {
                    items: { type: 'string' },
                    type: 'array'
                },
                recurringNotes: {
                    items: { type: 'string' },
                    type: 'array'
                },
                actions: {
                    items: { type: 'string' },
                    type: 'array'
                }
            },
            required: [
                'headline',
                'summary',
                'risks',
                'opportunities',
                'recurringNotes',
                'actions'
            ],
            type: 'object'
        },
        schemaName: 'cash_flow_forecast_insight',
        system: [
            'You write concise personal cash-flow forecast insights.',
            'Use only the provided deterministic projection, recurring pattern context, and confidence fields.',
            'Do not invent balances, vendors, bills, income sources, or transactions.',
            'Do not give investment, credit, tax, or legal advice.',
            'Make clear when confidence is low or when projection depends on detected recurring patterns.'
        ].join(' ')
    });
    return parseForecastInsight(parsed);
}

function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => {
            setTimeout(() => reject(new Error(message)), timeoutMs);
        })
    ]);
}

export async function cashFlowForecast(
    db: AppDb,
    config: Config,
    logger: Pick<Logger, 'warn'>,
    userId: number,
    query: CashFlowForecastQuery
): Promise<CashFlowForecastResponse> {
    const user = (await db.users.find(userId)) as UserDb | undefined;
    if (!user) {
        throw new Error('User was not found.');
    }

    const now = new Date();
    const forecastFrom = localStartOfDay(query.date ?? now, user.timezone);
    const historyFrom = addLocalDays(
        forecastFrom,
        -forecastHistoryDays,
        user.timezone
    );
    const historyTo = new Date(forecastFrom.getTime() - 1);
    const [categories, vendors, transactions] = await Promise.all([
        db.categories.where(category => category.userId, userId),
        db.vendors.where(vendor => vendor.userId, userId),
        db.transactions
            .include(transaction => transaction.category)
            .where(transaction => transaction.userId, userId)
            .where(transaction => transaction.occurredAt, '>=', historyFrom)
            .where(transaction => transaction.occurredAt, '<=', historyTo)
    ]);
    const forecast = buildCashFlowForecast({
        categories: categories as CategoryDb[],
        now,
        query,
        transactions: transactions as TransactionDb[],
        user,
        vendors: vendors as VendorDb[]
    });

    try {
        const insights = await withTimeout(
            generateForecastInsight(config, forecast),
            forecastInsightTimeoutMs,
            'OpenAI forecast insights timed out.'
        );
        return {
            ...forecast,
            insights,
            insightsStatus: 'available'
        };
    } catch (err) {
        if (err instanceof OpenAIConfigError) {
            return forecast;
        }
        logger.warn('Cash-flow forecast insights failed', {
            Error: err instanceof Error ? err.message : String(err),
            UserId: userId
        });
        return {
            ...forecast,
            insightsStatus: 'failed'
        };
    }
}
