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
> = async ({ query, principal }, { knex }) => {
    return listTransactions(knex, principal.userId, query);
};

export const createTransactionHandler: Handler<
    typeof CreateTransactionEndpoint
> = async ({ body, principal }, { knex, config, logger }) => {
    try {
        const transaction = await createTransaction(
            knex,
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
> = async ({ body, params, principal }, { knex, config }) => {
    try {
        return await updateTransaction(
            knex,
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
> = async ({ params, principal }, { knex }) => {
    try {
        await deleteTransaction(knex, principal.userId, params.id);
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
> = async ({ query, principal }, { knex }) => {
    return dashboardSummary(knex, principal.userId, query.period ?? 'month');
};

export const statsOverviewHandler: Handler<
    typeof StatsOverviewEndpoint
> = async ({ query, principal }, { knex }) => {
    return statsOverview(knex, principal.userId, query.period ?? 'month');
};
