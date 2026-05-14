import { ActionResult, type Handler } from '@cleverbrush/server';
import {
    createTransaction,
    dashboardSummary,
    deleteTransaction,
    listTransactions,
    statsOverview,
    TransactionCategoryError,
    TransactionNotFoundError,
    updateTransaction
} from '../../application/transactions.js';
import type {
    CreateTransactionEndpoint,
    DashboardSummaryEndpoint,
    DeleteTransactionEndpoint,
    ListTransactionsEndpoint,
    StatsOverviewEndpoint,
    UpdateTransactionEndpoint
} from '../endpoints.js';

export const listTransactionsHandler: Handler<
    typeof ListTransactionsEndpoint
> = async ({ query, principal }, { db }) => {
    return listTransactions(db, principal.userId, query);
};

export const createTransactionHandler: Handler<
    typeof CreateTransactionEndpoint
> = async ({ body, principal }, { db, config, logger }) => {
    try {
        const transaction = await createTransaction(
            db,
            config,
            principal.userId,
            body
        );
        logger.info('Transaction {TransactionId} created by {UserId}', {
            TransactionId: transaction.id,
            UserId: principal.userId
        });
        return ActionResult.created(
            transaction,
            `/api/transactions/${transaction.id}`
        );
    } catch (err) {
        if (err instanceof TransactionCategoryError) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};

export const updateTransactionHandler: Handler<
    typeof UpdateTransactionEndpoint
> = async ({ body, params, principal }, { db, config }) => {
    try {
        return await updateTransaction(
            db,
            config,
            principal.userId,
            params.id,
            body
        );
    } catch (err) {
        if (err instanceof TransactionNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        if (err instanceof TransactionCategoryError) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};

export const deleteTransactionHandler: Handler<
    typeof DeleteTransactionEndpoint
> = async ({ params, principal }, { db }) => {
    try {
        await deleteTransaction(db, principal.userId, params.id);
        return ActionResult.noContent();
    } catch (err) {
        if (err instanceof TransactionNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        throw err;
    }
};

export const dashboardSummaryHandler: Handler<
    typeof DashboardSummaryEndpoint
> = async ({ query, principal }, { db }) => {
    return dashboardSummary(
        db,
        principal.userId,
        query.period ?? 'day',
        query.date
    );
};

export const statsOverviewHandler: Handler<
    typeof StatsOverviewEndpoint
> = async ({ query, principal }, { db }) => {
    return statsOverview(db, principal.userId, query);
};
