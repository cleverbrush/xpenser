import type {
    CreateTransactionBody,
    DashboardSummary,
    StatsOverview,
    Transaction,
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

type DashboardPeriod = 'week' | 'month' | 'quarter' | 'year';

type StatsBucket = StatsOverview['trend'][number];

type StatsCategory = StatsOverview['byCategory'][number];

function mapTransaction(row: TransactionDb): Transaction {
    return {
        id: row.id,
        categoryId: row.categoryId,
        categoryName: row.category?.name ?? '',
        type: row.type,
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

    const rows = ((await builder.orderBy(
        transaction => transaction.occurredAt,
        query.direction ?? 'desc'
    )) ?? []) as TransactionDb[];

    const search = query.search?.trim().toLowerCase();
    const filtered = search
        ? rows.filter(
              transaction =>
                  transaction.category?.name.toLowerCase().includes(search) ||
                  transaction.note?.toLowerCase().includes(search)
          )
        : rows;
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

function periodRange(period: DashboardPeriod, now = new Date()) {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);

    if (period === 'week') {
        const day = from.getDay();
        from.setDate(from.getDate() - (day === 0 ? 6 : day - 1));
    } else if (period === 'month') {
        from.setDate(1);
    } else if (period === 'quarter') {
        from.setMonth(Math.floor(from.getMonth() / 3) * 3, 1);
    } else {
        from.setMonth(0, 1);
    }

    return { from, to: now };
}

function bucketKey(date: Date, period: DashboardPeriod): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    if (period === 'quarter' || period === 'year') {
        return `${year}-${month}`;
    }

    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function bucketLabel(date: Date, period: DashboardPeriod): string {
    if (period === 'week') {
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'short'
        }).format(date);
    }

    if (period === 'month') {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric'
        }).format(date);
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short'
    }).format(date);
}

function addBucketStep(date: Date, period: DashboardPeriod): void {
    if (period === 'quarter' || period === 'year') {
        date.setMonth(date.getMonth() + 1, 1);
        return;
    }

    date.setDate(date.getDate() + 1);
}

function trendBuckets(
    period: DashboardPeriod,
    range: ReturnType<typeof periodRange>
): Map<string, StatsBucket> {
    const buckets = new Map<string, StatsBucket>();
    const current = new Date(range.from);

    if (period === 'quarter' || period === 'year') {
        current.setDate(1);
    }

    while (current <= range.to) {
        const key = bucketKey(current, period);
        buckets.set(key, {
            bucket: key,
            label: bucketLabel(current, period),
            incomeTotal: 0,
            expenseTotal: 0,
            netTotal: 0,
            transactionCount: 0
        });
        addBucketStep(current, period);
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
    return (
        categories
            .filter(category => category.type === type)
            .sort((left, right) => right.total - left.total)[0]?.categoryName ??
        ''
    );
}

export async function dashboardSummary(
    db: AppDb,
    userId: number,
    period: DashboardPeriod
): Promise<DashboardSummary> {
    const user = await getUser(db, userId);
    const range = periodRange(period);

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
        current.total += Number(row.defaultCurrencyAmount);
        totalsByCategory.set(key, current);
    }

    const byCategory = Array.from(totalsByCategory.values());
    const latest = (await db.transactions
        .include(transaction => transaction.category)
        .where(transaction => transaction.userId, userId)
        .orderBy(transaction => transaction.occurredAt, 'desc')
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
        latestTransactions: latest.map(mapTransaction)
    };
}

export async function statsOverview(
    db: AppDb,
    userId: number,
    period: DashboardPeriod
): Promise<StatsOverview> {
    const user = await getUser(db, userId);
    const range = periodRange(period);
    const buckets = trendBuckets(period, range);

    const rows = (await db.transactions
        .include(transaction => transaction.category)
        .where(transaction => transaction.userId, userId)
        .whereBetween(
            transaction => transaction.occurredAt,
            [range.from, range.to]
        )) as TransactionDb[];

    const categories = new Map<string, StatsCategory>();
    let incomeTotal = 0;
    let expenseTotal = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    for (const row of rows) {
        const total = Number(row.defaultCurrencyAmount);
        const type = row.type;
        const date = new Date(row.occurredAt);
        const bucket = buckets.get(bucketKey(date, period));

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
            bucket.netTotal = bucket.incomeTotal - bucket.expenseTotal;
        }

        const categoryKey = `${type}:${row.categoryId}`;
        const category = categories.get(categoryKey) ?? {
            categoryId: row.categoryId,
            categoryName: row.category?.name ?? '',
            type,
            total: 0,
            share: 0
        };
        category.total += total;
        categories.set(categoryKey, category);
    }

    const byCategory = Array.from(categories.values())
        .map(category => ({
            ...category,
            share: computeShare(
                category.total,
                category.type === 'income' ? incomeTotal : expenseTotal
            )
        }))
        .sort((left, right) => right.total - left.total);
    const netTotal = incomeTotal - expenseTotal;

    return {
        period,
        from: range.from,
        to: range.to,
        currency: user.defaultCurrency,
        incomeTotal,
        expenseTotal,
        netTotal,
        savingsRate: incomeTotal > 0 ? (netTotal / incomeTotal) * 100 : 0,
        transactionCount: rows.length,
        incomeCount,
        expenseCount,
        averageIncome: incomeCount > 0 ? incomeTotal / incomeCount : 0,
        averageExpense: expenseCount > 0 ? expenseTotal / expenseCount : 0,
        largestIncomeCategory: topCategory(byCategory, 'income'),
        largestExpenseCategory: topCategory(byCategory, 'expense'),
        trend: Array.from(buckets.values()),
        byCategory
    };
}
