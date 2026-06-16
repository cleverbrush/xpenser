import { ActionResult, type Handler } from '@cleverbrush/server';
import { cashFlowForecast } from '../../application/cash-flow-forecast.js';
import {
    categoryTrend,
    createTransaction,
    dashboardSummary,
    dashboardWindow,
    deleteTransaction,
    getTransactionScanImage,
    listTransactions,
    statsOverview,
    statsWindow,
    TransactionCategoryError,
    TransactionNotFoundError,
    updateTransaction
} from '../../application/transactions.js';
import { TransactionCreated } from '../../log-templates.js';
import type {
    CashFlowForecastEndpoint,
    CategoryTrendEndpoint,
    CreateTransactionEndpoint,
    DashboardSummaryEndpoint,
    DashboardWindowEndpoint,
    DeleteTransactionEndpoint,
    GetTransactionScanImageEndpoint,
    ListTransactionsEndpoint,
    StatsOverviewEndpoint,
    StatsWindowEndpoint,
    UpdateTransactionEndpoint
} from '../endpoints.js';

export const listTransactionsHandler: Handler<
    typeof ListTransactionsEndpoint
> = async ({ query, principal }, { db, knex }) => {
    return listTransactions(db, principal.userId, query, knex);
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
        logger.info(TransactionCreated, {
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

export const getTransactionScanImageHandler: Handler<
    typeof GetTransactionScanImageEndpoint
> = async ({ params, principal }, { knex }) => {
    try {
        return await getTransactionScanImage(knex, principal.userId, params.id);
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
        query.date,
        query.vendorLimit
    );
};

export const dashboardWindowHandler: Handler<
    typeof DashboardWindowEndpoint
> = async ({ query, principal }, { db }) => {
    return dashboardWindow(db, principal.userId, {
        after: query.after,
        before: query.before,
        date: query.date,
        vendorLimit: query.vendorLimit,
        period: query.period ?? 'day'
    });
};

export const statsOverviewHandler: Handler<
    typeof StatsOverviewEndpoint
> = async ({ query, principal }, { db }) => {
    return statsOverview(db, principal.userId, query);
};

export const statsWindowHandler: Handler<typeof StatsWindowEndpoint> = async (
    { query, principal },
    { db }
) => {
    return statsWindow(db, principal.userId, {
        after: query.after,
        before: query.before,
        date: query.date,
        period: query.period ?? 'day'
    });
};

export const categoryTrendHandler: Handler<
    typeof CategoryTrendEndpoint
> = async ({ params, query, principal }, { db }) => {
    try {
        return await categoryTrend(db, principal.userId, params.id, query);
    } catch (err) {
        if (err instanceof TransactionCategoryError) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};

export const cashFlowForecastHandler: Handler<
    typeof CashFlowForecastEndpoint
> = async ({ query, principal }, { db, config, logger }) => {
    return cashFlowForecast(db, config, logger, principal.userId, query);
};
