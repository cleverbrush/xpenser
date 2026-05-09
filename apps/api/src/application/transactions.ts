import type {
    CreateTransactionBody,
    DashboardSummary,
    Transaction,
    TransactionListQuery
} from '@xpenser/contracts';
import type { Knex } from 'knex';
import type { Config } from '../config.js';
import type { CategoryRow, TransactionRow, UserRow } from '../db/schemas.js';
import {
    convertAmount,
    getExchangeRate,
    transactionDate
} from './currencies.js';

export class TransactionNotFoundError extends Error {}
export class TransactionCategoryError extends Error {}

type DashboardPeriod = 'week' | 'month' | 'quarter' | 'year';

function mapTransaction(row: TransactionRow): Transaction {
    return {
        id: row.id,
        categoryId: row.category_id,
        categoryName: row.category_name,
        type: row.type,
        amount: Number(row.amount),
        currency: row.currency,
        defaultCurrencyAmount: Number(row.default_currency_amount),
        defaultCurrency: row.default_currency,
        exchangeRate: Number(row.exchange_rate),
        exchangeRateDate: row.exchange_rate_date,
        occurredAt: row.occurred_at,
        note: row.note ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function getUser(knex: Knex, userId: number): Promise<UserRow> {
    const user = await knex<UserRow>('users').where({ id: userId }).first();
    if (!user) {
        throw new TransactionCategoryError('User was not found.');
    }
    return user;
}

async function getCategory(
    knex: Knex,
    userId: number,
    categoryId: number
): Promise<CategoryRow> {
    const category = await knex<CategoryRow>('categories')
        .where({ id: categoryId, user_id: userId })
        .first();
    if (!category) {
        throw new TransactionCategoryError('Category was not found.');
    }
    return category;
}

function transactionSelection(knex: Knex) {
    return knex('transactions')
        .join('categories', 'categories.id', 'transactions.category_id')
        .select(
            'transactions.id',
            'transactions.user_id',
            'transactions.category_id',
            'categories.name as category_name',
            'transactions.type',
            'transactions.amount',
            'transactions.currency',
            'transactions.default_currency_amount',
            'transactions.default_currency',
            'transactions.exchange_rate',
            'transactions.exchange_rate_date',
            'transactions.occurred_at',
            'transactions.note',
            'transactions.created_at',
            'transactions.updated_at'
        );
}

export async function listTransactions(
    knex: Knex,
    userId: number,
    query: TransactionListQuery
) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const base = transactionSelection(knex).where(
        'transactions.user_id',
        userId
    );

    if (query.type) {
        base.where('transactions.type', query.type);
    }
    if (query.categoryId) {
        base.where('transactions.category_id', query.categoryId);
    }
    if (query.from) {
        base.where('transactions.occurred_at', '>=', query.from);
    }
    if (query.to) {
        base.where('transactions.occurred_at', '<=', query.to);
    }
    if (query.search) {
        base.where(builder => {
            builder
                .whereILike('categories.name', `%${query.search}%`)
                .orWhereILike('transactions.note', `%${query.search}%`);
        });
    }

    const countQuery = base
        .clone()
        .clearSelect()
        .clearOrder()
        .count<{ count: string | number }[]>({ count: 'transactions.id' })
        .first();

    const rows = await base
        .orderBy('transactions.occurred_at', query.direction ?? 'desc')
        .limit(limit)
        .offset((page - 1) * limit);
    const count = await countQuery;

    return {
        items: (rows as TransactionRow[]).map(mapTransaction),
        total: Number(count?.count ?? 0),
        page,
        limit
    };
}

export async function createTransaction(
    knex: Knex,
    config: Config,
    userId: number,
    body: CreateTransactionBody
): Promise<Transaction> {
    const user = await getUser(knex, userId);
    const category = await getCategory(knex, userId, body.categoryId);
    const date = transactionDate(body.occurredAt);
    const exchange = await getExchangeRate(
        knex,
        config,
        body.currency,
        user.default_currency,
        date
    );

    const [created] = await knex('transactions')
        .insert({
            user_id: userId,
            category_id: body.categoryId,
            type: category.type,
            amount: body.amount,
            currency: body.currency,
            default_currency_amount: convertAmount(body.amount, exchange.rate),
            default_currency: user.default_currency,
            exchange_rate: exchange.rate,
            exchange_rate_date: exchange.rateDate,
            occurred_at: body.occurredAt,
            note: body.note ?? null
        })
        .returning('id');

    return getTransaction(knex, userId, Number(created.id));
}

export async function getTransaction(
    knex: Knex,
    userId: number,
    transactionId: number
): Promise<Transaction> {
    const row = await transactionSelection(knex)
        .where('transactions.id', transactionId)
        .where('transactions.user_id', userId)
        .first<TransactionRow>();
    if (!row) {
        throw new TransactionNotFoundError('Transaction was not found.');
    }
    return mapTransaction(row);
}

export async function updateTransaction(
    knex: Knex,
    config: Config,
    userId: number,
    transactionId: number,
    body: Partial<CreateTransactionBody>
): Promise<Transaction> {
    const current = await getTransaction(knex, userId, transactionId);
    const next = {
        categoryId: body.categoryId ?? current.categoryId,
        amount: body.amount ?? current.amount,
        currency: body.currency ?? current.currency,
        occurredAt: body.occurredAt ?? current.occurredAt,
        note: body.note ?? current.note
    };

    const user = await getUser(knex, userId);
    const category = await getCategory(knex, userId, next.categoryId);
    const exchange = await getExchangeRate(
        knex,
        config,
        next.currency,
        user.default_currency,
        transactionDate(next.occurredAt)
    );

    await knex('transactions')
        .where({ id: transactionId, user_id: userId })
        .update({
            category_id: next.categoryId,
            type: category.type,
            amount: next.amount,
            currency: next.currency,
            default_currency_amount: convertAmount(next.amount, exchange.rate),
            default_currency: user.default_currency,
            exchange_rate: exchange.rate,
            exchange_rate_date: exchange.rateDate,
            occurred_at: next.occurredAt,
            note: next.note ?? null,
            updated_at: knex.fn.now()
        });

    return getTransaction(knex, userId, transactionId);
}

export async function deleteTransaction(
    knex: Knex,
    userId: number,
    transactionId: number
): Promise<void> {
    const deleted = await knex('transactions')
        .where({ id: transactionId, user_id: userId })
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

export async function dashboardSummary(
    knex: Knex,
    userId: number,
    period: DashboardPeriod
): Promise<DashboardSummary> {
    const user = await getUser(knex, userId);
    const range = periodRange(period);

    const rows = (await knex('transactions')
        .join('categories', 'categories.id', 'transactions.category_id')
        .select(
            'transactions.category_id',
            'categories.name as category_name',
            'transactions.type'
        )
        .sum({ total: 'transactions.default_currency_amount' })
        .where('transactions.user_id', userId)
        .whereBetween('transactions.occurred_at', [range.from, range.to])
        .groupBy(
            'transactions.category_id',
            'categories.name',
            'transactions.type'
        )) as Array<{
        readonly category_id: number;
        readonly category_name: string;
        readonly type: 'expense' | 'income';
        readonly total?: string | number;
    }>;

    const byCategory = rows.map(row => ({
        categoryId: Number(row.category_id),
        categoryName: String(row.category_name),
        type: row.type as 'expense' | 'income',
        total: Number(row.total ?? 0)
    }));

    const latest = await transactionSelection(knex)
        .where('transactions.user_id', userId)
        .orderBy('transactions.occurred_at', 'desc')
        .limit(5);

    return {
        period,
        from: range.from,
        to: range.to,
        currency: user.default_currency,
        expenseTotal: byCategory
            .filter(item => item.type === 'expense')
            .reduce((sum, item) => sum + item.total, 0),
        incomeTotal: byCategory
            .filter(item => item.type === 'income')
            .reduce((sum, item) => sum + item.total, 0),
        byCategory,
        latestTransactions: (latest as TransactionRow[]).map(mapTransaction)
    };
}
