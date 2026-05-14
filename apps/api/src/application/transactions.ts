import type {
    CreateTransactionBody,
    DashboardSummary,
    StatsOverview,
    StatsQuery,
    Transaction,
    TransactionEffect,
    TransactionListQuery
} from '@xpenser/contracts';
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

type StatsBucket = StatsOverview['trend'][number];

type StatsCategory = StatsOverview['byCategory'][number];

type StatsGroupBy = NonNullable<StatsQuery['groupBy']>;

type StatsTimeframe = NonNullable<StatsQuery['timeframe']>;

type StatsRange = {
    readonly from: Date;
    readonly to: Date;
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
    const date = transactionDate(body.occurredAt);
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
        transactionDate(next.occurredAt)
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

function cloneDate(value: Date): Date {
    return new Date(value.getTime());
}

function isValidDate(value: unknown): value is Date {
    return value instanceof Date && !Number.isNaN(value.getTime());
}

function startOfDay(value: Date): Date {
    const date = cloneDate(value);
    date.setHours(0, 0, 0, 0);
    return date;
}

function endOfDay(value: Date): Date {
    const date = cloneDate(value);
    date.setHours(23, 59, 59, 999);
    return date;
}

function startOfWeek(value: Date): Date {
    const date = startOfDay(value);
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    return date;
}

function startOfMonth(value: Date): Date {
    const date = startOfDay(value);
    date.setDate(1);
    return date;
}

function endOfMonth(value: Date): Date {
    return new Date(startOfMonth(addMonthsClamped(value, 1)).getTime() - 1);
}

function startOfQuarter(value: Date): Date {
    const date = startOfMonth(value);
    date.setMonth(Math.floor(date.getMonth() / 3) * 3, 1);
    return date;
}

function endOfQuarter(value: Date): Date {
    return new Date(addMonthsClamped(startOfQuarter(value), 3).getTime() - 1);
}

function startOfYear(value: Date): Date {
    const date = startOfDay(value);
    date.setMonth(0, 1);
    return date;
}

function endOfYear(value: Date): Date {
    const date = startOfYear(value);
    date.setFullYear(date.getFullYear() + 1);
    return new Date(date.getTime() - 1);
}

function daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

function addDays(value: Date, days: number): Date {
    const date = cloneDate(value);
    date.setDate(date.getDate() + days);
    return date;
}

function endOfWeek(value: Date): Date {
    return endOfDay(addDays(startOfWeek(value), 6));
}

function addMonthsClamped(value: Date, months: number): Date {
    const source = cloneDate(value);
    const day = source.getDate();
    source.setDate(1);
    source.setMonth(source.getMonth() + months);
    source.setDate(
        Math.min(day, daysInMonth(source.getFullYear(), source.getMonth()))
    );
    return source;
}

function addYearsClamped(value: Date, years: number): Date {
    const source = cloneDate(value);
    const day = source.getDate();
    source.setDate(1);
    source.setFullYear(source.getFullYear() + years);
    source.setDate(
        Math.min(day, daysInMonth(source.getFullYear(), source.getMonth()))
    );
    return source;
}

function previousRollingRange(range: StatsRange): StatsRange {
    const duration = range.to.getTime() - range.from.getTime();
    const to = new Date(range.from.getTime() - 1);
    return {
        from: new Date(to.getTime() - duration),
        to
    };
}

function previousCalendarMonthRange(range: StatsRange): StatsRange {
    const to = new Date(startOfMonth(range.from).getTime() - 1);
    return {
        from: startOfMonth(addMonthsClamped(range.from, -1)),
        to
    };
}

function shiftRangeDays(range: StatsRange, days: number): StatsRange {
    return {
        from: addDays(range.from, days),
        to: addDays(range.to, days)
    };
}

function shiftRangeMonths(range: StatsRange, months: number): StatsRange {
    return {
        from: addMonthsClamped(range.from, months),
        to: addMonthsClamped(range.to, months)
    };
}

function shiftRangeYears(range: StatsRange, years: number): StatsRange {
    return {
        from: addYearsClamped(range.from, years),
        to: addYearsClamped(range.to, years)
    };
}

function normalizeRange(from: Date, to: Date): StatsRange {
    return from <= to
        ? { from, to }
        : { from: startOfDay(to), to: endOfDay(from) };
}

export function resolveDashboardRange(
    period: DashboardPeriod,
    date = new Date(),
    now = new Date()
): StatsRange {
    const anchor = isValidDate(date) ? date : now;
    const selected = startOfDay(anchor);
    let from: Date;
    let to: Date;

    if (period === 'day') {
        from = startOfDay(selected);
        to = endOfDay(selected);
    } else if (period === 'week') {
        from = startOfWeek(selected);
        to = endOfWeek(selected);
    } else if (period === 'month') {
        from = startOfMonth(selected);
        to = endOfMonth(selected);
    } else if (period === 'quarter') {
        from = startOfQuarter(selected);
        to = endOfQuarter(selected);
    } else {
        from = startOfYear(selected);
        to = endOfYear(selected);
    }

    return {
        from,
        to: from <= now && now <= to ? now : to
    };
}

export function resolveStatsRanges(
    query: Partial<StatsQuery>,
    now = new Date()
) {
    const timeframe = (query.timeframe ?? 'this-month') as StatsTimeframe;
    const today = startOfDay(now);
    let selected: StatsRange;

    if (timeframe === 'this-week') {
        selected = { from: startOfWeek(now), to: now };
    } else if (timeframe === 'last-7-days') {
        selected = { from: addDays(today, -6), to: now };
    } else if (timeframe === 'last-month') {
        const currentMonth = startOfMonth(now);
        selected = {
            from: startOfMonth(addMonthsClamped(currentMonth, -1)),
            to: new Date(currentMonth.getTime() - 1)
        };
    } else if (timeframe === 'last-30-days') {
        selected = { from: addDays(today, -29), to: now };
    } else if (timeframe === 'custom') {
        selected = normalizeRange(
            isValidDate(query.from)
                ? startOfDay(query.from)
                : startOfMonth(now),
            isValidDate(query.to) ? endOfDay(query.to) : now
        );
    } else {
        selected = { from: startOfMonth(now), to: now };
    }

    let previousPeriod: StatsRange;
    if (timeframe === 'this-week') {
        previousPeriod = shiftRangeDays(selected, -7);
    } else if (timeframe === 'this-month') {
        previousPeriod = shiftRangeMonths(selected, -1);
    } else if (timeframe === 'last-month') {
        previousPeriod = previousCalendarMonthRange(selected);
    } else if (timeframe === 'last-7-days') {
        previousPeriod = shiftRangeDays(selected, -7);
    } else if (timeframe === 'last-30-days') {
        previousPeriod = shiftRangeDays(selected, -30);
    } else {
        previousPeriod = previousRollingRange(selected);
    }

    return {
        selected,
        previousPeriod,
        previousYear: shiftRangeYears(selected, -1)
    };
}

function statsBucketKey(date: Date, groupBy: StatsGroupBy): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    if (groupBy === 'month') {
        return `${year}-${month}`;
    }

    const bucketDate = groupBy === 'week' ? startOfWeek(date) : date;
    const bucketMonth = String(bucketDate.getMonth() + 1).padStart(2, '0');
    const bucketDay = String(bucketDate.getDate()).padStart(2, '0');
    return `${bucketDate.getFullYear()}-${bucketMonth}-${bucketDay}`;
}

function statsBucketLabel(date: Date, groupBy: StatsGroupBy): string {
    if (groupBy === 'month') {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            year: '2-digit'
        }).format(date);
    }

    if (groupBy === 'week') {
        return `Week of ${new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric'
        }).format(date)}`;
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric'
    }).format(date);
}

function addStatsBucketStep(date: Date, groupBy: StatsGroupBy): void {
    if (groupBy === 'month') {
        date.setMonth(date.getMonth() + 1, 1);
        return;
    }

    date.setDate(date.getDate() + (groupBy === 'week' ? 7 : 1));
}

function statsTrendBuckets(
    groupBy: StatsGroupBy,
    range: StatsRange
): Map<string, StatsBucket> {
    const buckets = new Map<string, StatsBucket>();
    const current =
        groupBy === 'week'
            ? startOfWeek(range.from)
            : groupBy === 'month'
              ? startOfMonth(range.from)
              : startOfDay(range.from);

    while (current <= range.to) {
        const key = statsBucketKey(current, groupBy);
        buckets.set(key, {
            bucket: key,
            label: statsBucketLabel(current, groupBy),
            incomeTotal: 0,
            expenseTotal: 0,
            netTotal: 0,
            transactionCount: 0
        });
        addStatsBucketStep(current, groupBy);
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
    buckets: Map<string, StatsBucket>
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
        const bucket = buckets.get(statsBucketKey(date, groupBy));

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
        const bucketIndex = bucketIndexes.get(statsBucketKey(date, groupBy));
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

export async function dashboardSummary(
    db: AppDb,
    userId: number,
    period: DashboardPeriod,
    date?: Date
): Promise<DashboardSummary> {
    const user = await getUser(db, userId);
    const range = resolveDashboardRange(period, date);

    const rows = (await db.transactions
        .include(transaction => transaction.category)
        .where(transaction => transaction.userId, userId)
        .whereBetween(
            transaction => transaction.occurredAt,
            [range.from, range.to]
        )) as TransactionDb[];

    const totalsByCategory = new Map<
        string,
        {
            categoryId: number;
            categoryName: string;
            type: 'expense' | 'income';
            total: number;
        }
    >();

    for (const row of rows) {
        const key = `${row.type}:${row.categoryId}`;
        const current = totalsByCategory.get(key) ?? {
            categoryId: row.categoryId,
            categoryName: row.category?.name ?? '',
            type: row.type,
            total: 0
        };
        current.total += transactionSignedDefaultAmount(row);
        totalsByCategory.set(key, current);
    }

    const byCategory = Array.from(totalsByCategory.values());
    const latest = (await db.transactions
        .include(transaction => transaction.category)
        .where(transaction => transaction.userId, userId)
        .whereBetween(
            transaction => transaction.occurredAt,
            [range.from, range.to]
        )
        .orderBy(transaction => transaction.occurredAt, 'desc')
        .orderBy(transaction => transaction.id, 'desc')
        .limit(5)) as TransactionDb[];

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
        byCategory,
        latestTransactions: [...latest]
            .sort(compareTransactionsByOccurrenceDesc)
            .map(mapTransaction)
    };
}

export async function statsOverview(
    db: AppDb,
    userId: number,
    query: StatsQuery
): Promise<StatsOverview> {
    const user = await getUser(db, userId);
    const groupBy = (query.groupBy ?? 'day') as StatsGroupBy;
    const timeframe = (query.timeframe ?? 'this-month') as StatsTimeframe;
    const ranges = resolveStatsRanges({ ...query, groupBy, timeframe });
    const buckets = statsTrendBuckets(groupBy, ranges.selected);
    const [selectedRows, previousPeriodRows, previousYearRows] =
        await Promise.all([
            transactionsForRange(db, userId, ranges.selected),
            transactionsForRange(db, userId, ranges.previousPeriod),
            transactionsForRange(db, userId, ranges.previousYear)
        ]);
    const selected = summarizeSelectedRows(selectedRows, groupBy, buckets);
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
