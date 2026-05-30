import type {
    CreateTransactionBody,
    DashboardSummary,
    DashboardWindowResponse,
    StatsOverview,
    StatsQuery,
    StatsWindowResponse,
    Transaction,
    TransactionEffect,
    TransactionListQuery
} from '@xpenser/contracts';
import {
    addLocalDays,
    addLocalMonths,
    addLocalYears,
    addStatsBucketStepInTimeZone,
    dateToLocalDateParam,
    defaultTimeZone,
    localDayDifference,
    localEndOfDay,
    localHour,
    localMonthIndex,
    localStartOfDay,
    localStartOfHour,
    localStartOfMonth,
    localStartOfWeek,
    resolveDashboardComparisonRangeInTimeZone,
    resolveDashboardRangeInTimeZone,
    statsBucketKeyInTimeZone,
    statsBucketLabelInTimeZone
} from '@xpenser/timezone';
import type { Config } from '../config.js';
import type {
    AppDb,
    CategoryDb,
    TransactionDb,
    UserDb
} from '../db/schemas.js';
import {
    convertAmount,
    getExchangeRate,
    transactionDate
} from './currencies.js';

export class TransactionNotFoundError extends Error {}
export class TransactionCategoryError extends Error {}

type DashboardPeriod = NonNullable<DashboardSummary['period']>;

type DashboardCategory = DashboardSummary['byCategory'][number];

type StatsBucket = StatsOverview['trend'][number];

type StatsCategory = StatsOverview['byCategory'][number];

type StatsGroupBy = NonNullable<StatsQuery['groupBy']>;

type StatsTimeframe = NonNullable<StatsQuery['timeframe']>;

type StatsRange = {
    readonly from: Date;
    readonly to: Date;
};

type StatsRanges = {
    readonly selected: StatsRange;
    readonly previousPeriod: StatsRange;
    readonly previousYear: StatsRange;
};

type PeriodWindowQuery = {
    readonly period?: DashboardPeriod;
    readonly date?: Date;
    readonly before?: number;
    readonly after?: number;
};

type CategoryComparison = {
    readonly categoryId: number;
    readonly categoryName: string;
    readonly type: 'expense' | 'income';
    readonly total: number;
};

function normalizeTransactionEffect(
    effect?: TransactionEffect | null
): TransactionEffect {
    return effect === 'reversal' ? 'reversal' : 'normal';
}

export function transactionSignedDefaultAmount(
    transaction: Pick<TransactionDb, 'defaultCurrencyAmount'> & {
        readonly effect?: TransactionEffect | null;
    }
): number {
    const amount = Number(transaction.defaultCurrencyAmount);
    return normalizeTransactionEffect(transaction.effect) === 'reversal'
        ? -amount
        : amount;
}

function mapTransaction(row: TransactionDb): Transaction {
    return {
        id: row.id,
        categoryId: row.categoryId,
        categoryName: row.category?.name ?? '',
        type: row.type,
        effect: normalizeTransactionEffect(row.effect),
        amount: Number(row.amount),
        currency: row.currency,
        defaultCurrencyAmount: Number(row.defaultCurrencyAmount),
        defaultCurrency: row.defaultCurrency,
        exchangeRate: Number(row.exchangeRate),
        exchangeRateDate: row.exchangeRateDate,
        occurredAt: row.occurredAt,
        note: row.note ?? undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

export function compareTransactionsByOccurrenceDesc(
    left: Pick<TransactionDb, 'id' | 'occurredAt'>,
    right: Pick<TransactionDb, 'id' | 'occurredAt'>
): number {
    return (
        right.occurredAt.getTime() - left.occurredAt.getTime() ||
        right.id - left.id
    );
}

export function compareTransactionsByOccurrenceAsc(
    left: Pick<TransactionDb, 'id' | 'occurredAt'>,
    right: Pick<TransactionDb, 'id' | 'occurredAt'>
): number {
    return (
        left.occurredAt.getTime() - right.occurredAt.getTime() ||
        left.id - right.id
    );
}

async function getUser(db: AppDb, userId: number): Promise<UserDb> {
    const user = await db.users.find(userId);
    if (!user) {
        throw new TransactionCategoryError('User was not found.');
    }
    return user as UserDb;
}

async function getCategory(
    db: AppDb,
    userId: number,
    categoryId: number
): Promise<CategoryDb> {
    const category = await db.categories
        .where(candidate => candidate.id, categoryId)
        .where(candidate => candidate.userId, userId)
        .first();
    if (!category) {
        throw new TransactionCategoryError('Category was not found.');
    }
    return category as CategoryDb;
}

export async function listTransactions(
    db: AppDb,
    userId: number,
    query: TransactionListQuery
) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    let builder = db.transactions
        .include(transaction => transaction.category)
        .where(transaction => transaction.userId, userId);

    if (query.type) {
        builder = builder.where(transaction => transaction.type, query.type);
    }
    if (query.categoryId) {
        builder = builder.where(
            transaction => transaction.categoryId,
            query.categoryId
        );
    }
    if (query.from) {
        builder = builder.where(
            transaction => transaction.occurredAt,
            '>=',
            query.from
        );
    }
    if (query.to) {
        builder = builder.where(
            transaction => transaction.occurredAt,
            '<=',
            query.to
        );
    }

    const direction = query.direction ?? 'desc';
    const rows = ((await builder
        .orderBy(transaction => transaction.occurredAt, direction)
        .orderBy(transaction => transaction.id, direction)) ??
        []) as TransactionDb[];
    const sortedRows = [...rows].sort(
        direction === 'asc'
            ? compareTransactionsByOccurrenceAsc
            : compareTransactionsByOccurrenceDesc
    );

    const search = query.search?.trim().toLowerCase();
    const filtered = search
        ? sortedRows.filter(
              transaction =>
                  transaction.category?.name.toLowerCase().includes(search) ||
                  transaction.note?.toLowerCase().includes(search)
          )
        : sortedRows;
    const offset = (page - 1) * limit;

    return {
        items: filtered.slice(offset, offset + limit).map(mapTransaction),
        total: filtered.length,
        page,
        limit
    };
}

export async function createTransaction(
    db: AppDb,
    config: Config,
    userId: number,
    body: CreateTransactionBody
): Promise<Transaction> {
    const user = await getUser(db, userId);
    const category = await getCategory(db, userId, body.categoryId);
    const date = transactionDate(body.occurredAt, user.timezone);
    const exchange = await getExchangeRate(
        db,
        config,
        body.currency,
        user.defaultCurrency,
        date
    );

    const created = await db.transactions.insert({
        userId,
        categoryId: body.categoryId,
        type: category.type,
        effect: body.effect ?? 'normal',
        amount: body.amount,
        currency: body.currency,
        defaultCurrencyAmount: convertAmount(body.amount, exchange.rate),
        defaultCurrency: user.defaultCurrency,
        exchangeRate: exchange.rate,
        exchangeRateDate: exchange.rateDate,
        occurredAt: body.occurredAt,
        note: body.note ?? undefined
    });

    return getTransaction(db, userId, created.id);
}

export async function getTransaction(
    db: AppDb,
    userId: number,
    transactionId: number
): Promise<Transaction> {
    const row = await db.transactions
        .include(transaction => transaction.category)
        .where(transaction => transaction.id, transactionId)
        .where(transaction => transaction.userId, userId)
        .first();
    if (!row) {
        throw new TransactionNotFoundError('Transaction was not found.');
    }
    return mapTransaction(row as TransactionDb);
}

export async function updateTransaction(
    db: AppDb,
    config: Config,
    userId: number,
    transactionId: number,
    body: Partial<CreateTransactionBody>
): Promise<Transaction> {
    const current = await getTransaction(db, userId, transactionId);
    const next = {
        categoryId: body.categoryId ?? current.categoryId,
        effect: body.effect ?? current.effect,
        amount: body.amount ?? current.amount,
        currency: body.currency ?? current.currency,
        occurredAt: body.occurredAt ?? current.occurredAt,
        note: body.note ?? current.note
    };

    const user = await getUser(db, userId);
    const category = await getCategory(db, userId, next.categoryId);
    const exchange = await getExchangeRate(
        db,
        config,
        next.currency,
        user.defaultCurrency,
        transactionDate(next.occurredAt, user.timezone)
    );

    await db.transactions
        .where(transaction => transaction.id, transactionId)
        .where(transaction => transaction.userId, userId)
        .update({
            categoryId: next.categoryId,
            type: category.type,
            effect: next.effect,
            amount: next.amount,
            currency: next.currency,
            defaultCurrencyAmount: convertAmount(next.amount, exchange.rate),
            defaultCurrency: user.defaultCurrency,
            exchangeRate: exchange.rate,
            exchangeRateDate: exchange.rateDate,
            occurredAt: next.occurredAt,
            note: next.note ?? undefined,
            updatedAt: new Date()
        });

    return getTransaction(db, userId, transactionId);
}

export async function deleteTransaction(
    db: AppDb,
    userId: number,
    transactionId: number
): Promise<void> {
    const deleted = await db.transactions
        .where(transaction => transaction.id, transactionId)
        .where(transaction => transaction.userId, userId)
        .delete();
    if (deleted === 0) {
        throw new TransactionNotFoundError('Transaction was not found.');
    }
}

function isValidDate(value: unknown): value is Date {
    return value instanceof Date && !Number.isNaN(value.getTime());
}

function previousRollingRange(range: StatsRange): StatsRange {
    const duration = range.to.getTime() - range.from.getTime();
    const to = new Date(range.from.getTime() - 1);
    return {
        from: new Date(to.getTime() - duration),
        to
    };
}

function previousCalendarMonthRange(
    range: StatsRange,
    timeZone: string
): StatsRange {
    const currentMonth = localStartOfMonth(range.from, timeZone);
    const to = new Date(currentMonth.getTime() - 1);
    return {
        from: localStartOfMonth(
            addLocalMonths(currentMonth, -1, timeZone),
            timeZone
        ),
        to
    };
}

function shiftRangeDays(
    range: StatsRange,
    days: number,
    timeZone: string
): StatsRange {
    return {
        from: addLocalDays(range.from, days, timeZone),
        to: addLocalDays(range.to, days, timeZone)
    };
}

function shiftRangeMonths(
    range: StatsRange,
    months: number,
    timeZone: string
): StatsRange {
    return {
        from: addLocalMonths(range.from, months, timeZone),
        to: addLocalMonths(range.to, months, timeZone)
    };
}

function shiftRangeYears(
    range: StatsRange,
    years: number,
    timeZone: string
): StatsRange {
    return {
        from: addLocalYears(range.from, years, timeZone),
        to: addLocalYears(range.to, years, timeZone)
    };
}

export function percentChange(current: number, previous: number): number {
    if (previous === 0) {
        if (current === 0) {
            return 0;
        }
        return current > 0 ? 100 : -100;
    }

    return ((current - previous) / Math.abs(previous)) * 100;
}

function normalizeRange(from: Date, to: Date, timeZone: string): StatsRange {
    return from <= to
        ? { from, to }
        : {
              from: localStartOfDay(to, timeZone),
              to: localEndOfDay(from, timeZone)
          };
}

export function resolveDashboardRange(
    period: DashboardPeriod,
    date = new Date(),
    now = new Date(),
    timeZone = defaultTimeZone
): StatsRange {
    return resolveDashboardRangeInTimeZone(period, date, now, timeZone);
}

export function resolveDashboardComparisonRange(
    period: DashboardPeriod,
    range: StatsRange,
    timeZone = defaultTimeZone
): StatsRange {
    return resolveDashboardComparisonRangeInTimeZone(period, range, timeZone);
}

const defaultPeriodWindowSide = 2;
const maxPeriodWindowSide = 4;

function clampPeriodWindowSide(value: number | undefined): number {
    if (!Number.isFinite(value)) {
        return defaultPeriodWindowSide;
    }
    return Math.min(
        maxPeriodWindowSide,
        Math.max(0, Math.trunc(value ?? defaultPeriodWindowSide))
    );
}

function addDashboardPeriods(
    period: DashboardPeriod,
    value: Date,
    offset: number,
    timeZone: string
): Date {
    let current = value;
    const direction = offset < 0 ? -1 : 1;

    for (let index = 0; index < Math.abs(offset); index += 1) {
        current =
            period === 'day'
                ? addLocalDays(current, direction, timeZone)
                : period === 'week'
                  ? addLocalDays(current, direction * 7, timeZone)
                  : period === 'month'
                    ? addLocalMonths(current, direction, timeZone)
                    : period === 'quarter'
                      ? addLocalMonths(current, direction * 3, timeZone)
                      : addLocalYears(current, direction, timeZone);
    }

    return current;
}

export function resolveDashboardPeriodWindow(
    period: DashboardPeriod,
    date = new Date(),
    now = new Date(),
    timeZone = defaultTimeZone,
    before?: number,
    after?: number
): Date[] {
    const beforeCount = clampPeriodWindowSide(before);
    const afterCount = clampPeriodWindowSide(after);
    const latestStart = resolveDashboardRange(
        period,
        now,
        now,
        timeZone
    ).from.getTime();
    const dates: Date[] = [];
    const seen = new Set<string>();

    for (let offset = -beforeCount; offset <= afterCount; offset += 1) {
        const candidate = addDashboardPeriods(period, date, offset, timeZone);
        const range = resolveDashboardRange(period, candidate, now, timeZone);
        if (offset > 0 && range.from.getTime() > latestStart) {
            continue;
        }

        const key = dateToLocalDateParam(range.from, timeZone);
        if (!seen.has(key)) {
            dates.push(range.from);
            seen.add(key);
        }
    }

    return dates;
}

function rangeKey(range: StatsRange, timeZone: string): string {
    return dateToLocalDateParam(range.from, timeZone);
}

function encompassingRange(ranges: readonly StatsRange[]): StatsRange {
    return {
        from: new Date(Math.min(...ranges.map(range => range.from.getTime()))),
        to: new Date(Math.max(...ranges.map(range => range.to.getTime())))
    };
}

function rowsInRange(
    rows: readonly TransactionDb[],
    range: StatsRange
): TransactionDb[] {
    return rows.filter(
        row => row.occurredAt >= range.from && row.occurredAt <= range.to
    );
}

export function dashboardStatsGroupBy(period: DashboardPeriod): StatsGroupBy {
    if (period === 'day') {
        return 'hour';
    }
    if (period === 'week') {
        return 'day';
    }
    if (period === 'year') {
        return 'month';
    }
    return 'week';
}

function dashboardTrendBucketCount(
    period: DashboardPeriod,
    range: StatsRange,
    timeZone: string
): number {
    if (period === 'day') {
        return 24;
    }
    if (period === 'week') {
        return 7;
    }
    if (period === 'month') {
        return Math.ceil(
            (localDayDifference(range.from, range.to, timeZone) + 1) / 7
        );
    }
    if (period === 'quarter') {
        return Math.ceil(
            (localDayDifference(range.from, range.to, timeZone) + 1) / 7
        );
    }
    return 12;
}

function dashboardTrendBucketIndex(
    period: DashboardPeriod,
    date: Date,
    range: StatsRange,
    timeZone: string
): number {
    if (period === 'day') {
        return localHour(date, timeZone);
    }
    if (period === 'week') {
        return localDayDifference(range.from, date, timeZone);
    }
    if (period === 'month') {
        return Math.floor(localDayDifference(range.from, date, timeZone) / 7);
    }
    if (period === 'quarter') {
        return Math.floor(localDayDifference(range.from, date, timeZone) / 7);
    }
    return localMonthIndex(date, timeZone);
}

export function resolveStatsRanges(
    query: Partial<StatsQuery>,
    now = new Date(),
    timeZone = defaultTimeZone
) {
    if (query.period) {
        const selected = resolveDashboardRange(
            query.period,
            query.date,
            now,
            timeZone
        );
        return {
            selected,
            previousPeriod: resolveDashboardComparisonRange(
                query.period,
                selected,
                timeZone
            ),
            previousYear: shiftRangeYears(selected, -1, timeZone)
        };
    }

    const timeframe = (query.timeframe ?? 'this-month') as StatsTimeframe;
    const today = localStartOfDay(now, timeZone);
    let selected: StatsRange;

    if (timeframe === 'this-week') {
        selected = { from: localStartOfWeek(now, timeZone), to: now };
    } else if (timeframe === 'last-7-days') {
        selected = { from: addLocalDays(today, -6, timeZone), to: now };
    } else if (timeframe === 'last-month') {
        const currentMonth = localStartOfMonth(now, timeZone);
        selected = {
            from: localStartOfMonth(
                addLocalMonths(currentMonth, -1, timeZone),
                timeZone
            ),
            to: new Date(currentMonth.getTime() - 1)
        };
    } else if (timeframe === 'last-30-days') {
        selected = { from: addLocalDays(today, -29, timeZone), to: now };
    } else if (timeframe === 'custom') {
        selected = normalizeRange(
            isValidDate(query.from)
                ? localStartOfDay(query.from, timeZone)
                : localStartOfMonth(now, timeZone),
            isValidDate(query.to) ? localEndOfDay(query.to, timeZone) : now,
            timeZone
        );
    } else {
        selected = { from: localStartOfMonth(now, timeZone), to: now };
    }

    let previousPeriod: StatsRange;
    if (timeframe === 'this-week') {
        previousPeriod = shiftRangeDays(selected, -7, timeZone);
    } else if (timeframe === 'this-month') {
        previousPeriod = shiftRangeMonths(selected, -1, timeZone);
    } else if (timeframe === 'last-month') {
        previousPeriod = previousCalendarMonthRange(selected, timeZone);
    } else if (timeframe === 'last-7-days') {
        previousPeriod = shiftRangeDays(selected, -7, timeZone);
    } else if (timeframe === 'last-30-days') {
        previousPeriod = shiftRangeDays(selected, -30, timeZone);
    } else {
        previousPeriod = previousRollingRange(selected);
    }

    return {
        selected,
        previousPeriod,
        previousYear: shiftRangeYears(selected, -1, timeZone)
    };
}

function statsTrendBuckets(
    groupBy: StatsGroupBy,
    range: StatsRange,
    timeZone: string
): Map<string, StatsBucket> {
    const buckets = new Map<string, StatsBucket>();
    let current =
        groupBy === 'hour'
            ? localStartOfHour(range.from, timeZone)
            : groupBy === 'week'
              ? localStartOfWeek(range.from, timeZone)
              : groupBy === 'month'
                ? localStartOfMonth(range.from, timeZone)
                : localStartOfDay(range.from, timeZone);

    while (current <= range.to) {
        const key = statsBucketKeyInTimeZone(current, groupBy, timeZone);
        buckets.set(key, {
            bucket: key,
            label: statsBucketLabelInTimeZone(current, groupBy, timeZone),
            incomeTotal: 0,
            expenseTotal: 0,
            netTotal: 0,
            transactionCount: 0
        });
        current = addStatsBucketStepInTimeZone(current, groupBy, timeZone);
    }

    return buckets;
}

function computeShare(total: number, basis: number): number {
    return basis > 0 ? (total / basis) * 100 : 0;
}

function topCategory(
    categories: readonly StatsCategory[],
    type: 'expense' | 'income'
): string {
    const category = categories
        .filter(candidate => candidate.type === type)
        .sort((left, right) => right.total - left.total)[0];
    return category && category.total > 0 ? category.categoryName : '';
}

function emptyStatsCategory(
    category: Pick<StatsCategory, 'categoryId' | 'categoryName' | 'type'>,
    bucketCount: number
): StatsCategory {
    return {
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        type: category.type,
        total: 0,
        share: 0,
        transactionCount: 0,
        trend: Array.from({ length: bucketCount }, () => 0),
        previousPeriodTotal: 0,
        previousYearTotal: 0
    };
}

function summarizeSelectedRows(
    rows: readonly TransactionDb[],
    groupBy: StatsGroupBy,
    buckets: Map<string, StatsBucket>,
    timeZone: string
) {
    const bucketKeys = Array.from(buckets.keys());
    const bucketIndexes = new Map(
        bucketKeys.map((key, index) => [key, index] as const)
    );
    const categories = new Map<string, StatsCategory>();
    let incomeTotal = 0;
    let expenseTotal = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    for (const row of rows) {
        const total = transactionSignedDefaultAmount(row);
        const type = row.type;
        const date = new Date(row.occurredAt);
        const bucket = buckets.get(
            statsBucketKeyInTimeZone(date, groupBy, timeZone)
        );

        if (type === 'income') {
            incomeTotal += total;
            incomeCount += 1;
            if (bucket) {
                bucket.incomeTotal += total;
            }
        } else {
            expenseTotal += total;
            expenseCount += 1;
            if (bucket) {
                bucket.expenseTotal += total;
            }
        }

        if (bucket) {
            bucket.transactionCount += 1;
        }

        const categoryKey = `${type}:${row.categoryId}`;
        const category =
            categories.get(categoryKey) ??
            emptyStatsCategory(
                {
                    categoryId: row.categoryId,
                    categoryName: row.category?.name ?? '',
                    type
                },
                bucketKeys.length
            );
        const bucketIndex = bucketIndexes.get(
            statsBucketKeyInTimeZone(date, groupBy, timeZone)
        );
        category.total += total;
        category.transactionCount += 1;
        if (bucketIndex !== undefined) {
            category.trend[bucketIndex] =
                (category.trend[bucketIndex] ?? 0) + total;
        }
        categories.set(categoryKey, category);
    }

    for (const bucket of buckets.values()) {
        bucket.netTotal = bucket.incomeTotal - bucket.expenseTotal;
    }

    return {
        categories,
        incomeTotal,
        expenseTotal,
        incomeCount,
        expenseCount,
        transactionCount: rows.length,
        trend: Array.from(buckets.values())
    };
}

function summarizeComparisonRows(
    rows: readonly TransactionDb[],
    range: StatsRange
) {
    const categories = new Map<string, CategoryComparison>();
    let incomeTotal = 0;
    let expenseTotal = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    for (const row of rows) {
        const total = transactionSignedDefaultAmount(row);
        const type = row.type;

        if (type === 'income') {
            incomeTotal += total;
            incomeCount += 1;
        } else {
            expenseTotal += total;
            expenseCount += 1;
        }

        const categoryKey = `${type}:${row.categoryId}`;
        const category = categories.get(categoryKey) ?? {
            categoryId: row.categoryId,
            categoryName: row.category?.name ?? '',
            type,
            total: 0
        };
        categories.set(categoryKey, {
            ...category,
            total: category.total + total
        });
    }

    return {
        categories,
        summary: {
            from: range.from,
            to: range.to,
            incomeTotal,
            expenseTotal,
            netTotal: incomeTotal - expenseTotal,
            transactionCount: rows.length,
            incomeCount,
            expenseCount
        }
    };
}

function mergeComparisonCategoryTotals(
    selectedCategories: Map<string, StatsCategory>,
    comparisonCategories: Map<string, CategoryComparison>,
    field: 'previousPeriodTotal' | 'previousYearTotal',
    bucketCount: number
): void {
    for (const [key, comparison] of comparisonCategories) {
        const category =
            selectedCategories.get(key) ??
            emptyStatsCategory(comparison, bucketCount);
        category[field] = comparison.total;
        selectedCategories.set(key, category);
    }
}

async function transactionsForRange(
    db: AppDb,
    userId: number,
    range: StatsRange
) {
    return (await db.transactions
        .include(transaction => transaction.category)
        .where(transaction => transaction.userId, userId)
        .whereBetween(
            transaction => transaction.occurredAt,
            [range.from, range.to]
        )) as TransactionDb[];
}

function summarizeDashboardRows(
    user: Pick<UserDb, 'defaultCurrency' | 'timezone'>,
    period: DashboardPeriod,
    range: StatsRange,
    rows: readonly TransactionDb[],
    previousRows: readonly TransactionDb[]
): DashboardSummary {
    const bucketCount = dashboardTrendBucketCount(period, range, user.timezone);
    const totalsByCategory = new Map<string, DashboardCategory>();
    const previousTotalsByCategory = new Map<string, number>();

    for (const row of previousRows) {
        const key = `${row.type}:${row.categoryId}`;
        previousTotalsByCategory.set(
            key,
            (previousTotalsByCategory.get(key) ?? 0) +
                transactionSignedDefaultAmount(row)
        );
    }

    for (const row of rows) {
        const key = `${row.type}:${row.categoryId}`;
        const current = totalsByCategory.get(key) ?? {
            categoryId: row.categoryId,
            categoryName: row.category?.name ?? '',
            type: row.type,
            total: 0,
            transactionCount: 0,
            previousPeriodTotal: 0,
            percentChange: 0,
            trend: Array.from({ length: bucketCount }, () => 0)
        };
        const total = transactionSignedDefaultAmount(row);
        const bucketIndex = dashboardTrendBucketIndex(
            period,
            row.occurredAt,
            range,
            user.timezone
        );

        current.total += total;
        current.transactionCount += 1;
        if (bucketIndex >= 0 && bucketIndex < current.trend.length) {
            current.trend[bucketIndex] =
                (current.trend[bucketIndex] ?? 0) + total;
        }
        totalsByCategory.set(key, current);
    }

    for (const [key, category] of totalsByCategory) {
        const previousTotal = previousTotalsByCategory.get(key) ?? 0;
        category.previousPeriodTotal = previousTotal;
        category.percentChange = percentChange(category.total, previousTotal);
    }

    const byCategory = Array.from(totalsByCategory.values()).sort(
        (left, right) =>
            right.total - left.total ||
            left.type.localeCompare(right.type) ||
            left.categoryName.localeCompare(right.categoryName)
    );

    return {
        period,
        from: range.from,
        to: range.to,
        currency: user.defaultCurrency,
        expenseTotal: byCategory
            .filter(item => item.type === 'expense')
            .reduce((sum, item) => sum + item.total, 0),
        incomeTotal: byCategory
            .filter(item => item.type === 'income')
            .reduce((sum, item) => sum + item.total, 0),
        byCategory
    };
}

export async function dashboardSummary(
    db: AppDb,
    userId: number,
    period: DashboardPeriod,
    date?: Date
): Promise<DashboardSummary> {
    const user = await getUser(db, userId);
    const range = resolveDashboardRange(
        period,
        date,
        new Date(),
        user.timezone
    );
    const comparisonRange = resolveDashboardComparisonRange(
        period,
        range,
        user.timezone
    );
    const [rows, previousRows] = await Promise.all([
        transactionsForRange(db, userId, range),
        transactionsForRange(db, userId, comparisonRange)
    ]);

    return summarizeDashboardRows(user, period, range, rows, previousRows);
}

export async function dashboardWindow(
    db: AppDb,
    userId: number,
    query: PeriodWindowQuery
): Promise<DashboardWindowResponse> {
    const user = await getUser(db, userId);
    const now = new Date();
    const period = query.period ?? 'day';
    const dates = resolveDashboardPeriodWindow(
        period,
        query.date ?? now,
        now,
        user.timezone,
        query.before,
        query.after
    );
    const plans = dates.map(date => {
        const range = resolveDashboardRange(period, date, now, user.timezone);
        return {
            date: rangeKey(range, user.timezone),
            range,
            previousRange: resolveDashboardComparisonRange(
                period,
                range,
                user.timezone
            )
        };
    });
    const allRows = await transactionsForRange(
        db,
        userId,
        encompassingRange(
            plans.flatMap(plan => [plan.range, plan.previousRange])
        )
    );

    return {
        items: plans.map(plan => ({
            date: plan.date,
            summary: summarizeDashboardRows(
                user,
                period,
                plan.range,
                rowsInRange(allRows, plan.range),
                rowsInRange(allRows, plan.previousRange)
            )
        }))
    };
}

function summarizeStatsRows(
    user: Pick<UserDb, 'defaultCurrency' | 'timezone'>,
    groupBy: StatsGroupBy,
    timeframe: StatsTimeframe,
    ranges: StatsRanges,
    selectedRows: readonly TransactionDb[],
    previousPeriodRows: readonly TransactionDb[],
    previousYearRows: readonly TransactionDb[]
): StatsOverview {
    const buckets = statsTrendBuckets(groupBy, ranges.selected, user.timezone);
    const selected = summarizeSelectedRows(
        selectedRows,
        groupBy,
        buckets,
        user.timezone
    );
    const previousPeriod = summarizeComparisonRows(
        previousPeriodRows,
        ranges.previousPeriod
    );
    const previousYear = summarizeComparisonRows(
        previousYearRows,
        ranges.previousYear
    );

    mergeComparisonCategoryTotals(
        selected.categories,
        previousPeriod.categories,
        'previousPeriodTotal',
        buckets.size
    );
    mergeComparisonCategoryTotals(
        selected.categories,
        previousYear.categories,
        'previousYearTotal',
        buckets.size
    );

    const byCategory = Array.from(selected.categories.values())
        .map(category => ({
            ...category,
            share: computeShare(
                category.total,
                category.type === 'income'
                    ? selected.incomeTotal
                    : selected.expenseTotal
            )
        }))
        .sort(
            (left, right) =>
                Math.max(
                    right.total,
                    right.previousPeriodTotal,
                    right.previousYearTotal
                ) -
                Math.max(
                    left.total,
                    left.previousPeriodTotal,
                    left.previousYearTotal
                )
        );
    const netTotal = selected.incomeTotal - selected.expenseTotal;

    return {
        groupBy,
        timeframe,
        from: ranges.selected.from,
        to: ranges.selected.to,
        currency: user.defaultCurrency,
        incomeTotal: selected.incomeTotal,
        expenseTotal: selected.expenseTotal,
        netTotal,
        savingsRate:
            selected.incomeTotal > 0
                ? (netTotal / selected.incomeTotal) * 100
                : 0,
        transactionCount: selected.transactionCount,
        incomeCount: selected.incomeCount,
        expenseCount: selected.expenseCount,
        averageIncome:
            selected.incomeCount > 0
                ? selected.incomeTotal / selected.incomeCount
                : 0,
        averageExpense:
            selected.expenseCount > 0
                ? selected.expenseTotal / selected.expenseCount
                : 0,
        largestIncomeCategory: topCategory(byCategory, 'income'),
        largestExpenseCategory: topCategory(byCategory, 'expense'),
        trend: selected.trend,
        byCategory,
        comparison: {
            previousPeriod: previousPeriod.summary,
            previousYear: previousYear.summary
        }
    };
}

export async function statsOverview(
    db: AppDb,
    userId: number,
    query: StatsQuery
): Promise<StatsOverview> {
    const user = await getUser(db, userId);
    const groupBy = (query.groupBy ?? 'day') as StatsGroupBy;
    const timeframe = (
        query.period ? 'custom' : (query.timeframe ?? 'this-month')
    ) as StatsTimeframe;
    const ranges = resolveStatsRanges(
        { ...query, groupBy, timeframe },
        new Date(),
        user.timezone
    );
    const [selectedRows, previousPeriodRows, previousYearRows] =
        await Promise.all([
            transactionsForRange(db, userId, ranges.selected),
            transactionsForRange(db, userId, ranges.previousPeriod),
            transactionsForRange(db, userId, ranges.previousYear)
        ]);

    return summarizeStatsRows(
        user,
        groupBy,
        timeframe,
        ranges,
        selectedRows,
        previousPeriodRows,
        previousYearRows
    );
}

export async function statsWindow(
    db: AppDb,
    userId: number,
    query: PeriodWindowQuery
): Promise<StatsWindowResponse> {
    const user = await getUser(db, userId);
    const now = new Date();
    const period = query.period ?? 'day';
    const groupBy = dashboardStatsGroupBy(period);
    const timeframe = 'custom';
    const dates = resolveDashboardPeriodWindow(
        period,
        query.date ?? now,
        now,
        user.timezone,
        query.before,
        query.after
    );
    const plans = dates.map(date => {
        const ranges = resolveStatsRanges(
            { date, groupBy, period, timeframe },
            now,
            user.timezone
        );
        return {
            date: rangeKey(ranges.selected, user.timezone),
            ranges
        };
    });
    const selectedRowsRange = encompassingRange(
        plans.flatMap(plan => [
            plan.ranges.selected,
            plan.ranges.previousPeriod
        ])
    );
    const previousYearRowsRange = encompassingRange(
        plans.map(plan => plan.ranges.previousYear)
    );
    const [selectedAndPreviousRows, previousYearRows] = await Promise.all([
        transactionsForRange(db, userId, selectedRowsRange),
        transactionsForRange(db, userId, previousYearRowsRange)
    ]);

    return {
        items: plans.map(plan => ({
            date: plan.date,
            overview: summarizeStatsRows(
                user,
                groupBy,
                timeframe,
                plan.ranges,
                rowsInRange(selectedAndPreviousRows, plan.ranges.selected),
                rowsInRange(
                    selectedAndPreviousRows,
                    plan.ranges.previousPeriod
                ),
                rowsInRange(previousYearRows, plan.ranges.previousYear)
            )
        }))
    };
}
