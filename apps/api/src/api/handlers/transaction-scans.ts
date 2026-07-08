import {
    ActionResult,
    type Handler,
    type SubscriptionHandler
} from '@cleverbrush/server';
import {
    BudgetAccessError,
    BudgetPermissionError
} from '../../application/budgets.js';
import {
    getTransactionScanJobStatus,
    startTransactionScanJob,
    subscribeTransactionScanJob
} from '../../application/transaction-scan-jobs.js';
import {
    recordTransactionScanDecision,
    scanTransactionsFromImage,
    TransactionScanInputError,
    TransactionScanNotFoundError
} from '../../application/transaction-scans.js';
import type {
    CreateTransactionScanEndpoint,
    DecideTransactionScanItemEndpoint,
    StartTransactionScanJobEndpoint,
    TransactionScanJobStatusEndpoint,
    TransactionScanProgressEndpoint
} from '../endpoints.js';

function budgetResult(err: unknown) {
    if (err instanceof BudgetPermissionError) {
        return ActionResult.forbidden({ message: err.message });
    }
    if (err instanceof BudgetAccessError) {
        return ActionResult.notFound({ message: err.message });
    }
    return undefined;
}

export const createTransactionScanHandler: Handler<
    typeof CreateTransactionScanEndpoint
> = async ({ body, principal }, { db, config }) => {
    try {
        const scan = await scanTransactionsFromImage(
            db,
            config,
            principal.userId,
            body
        );
        return ActionResult.created(
            scan,
            `/api/transaction-scans/${scan.scanId}`
        );
    } catch (err) {
        const result = budgetResult(err);
        if (result) {
            return result;
        }
        if (err instanceof TransactionScanInputError) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};

export const startTransactionScanJobHandler: Handler<
    typeof StartTransactionScanJobEndpoint
> = async ({ body, principal }, { db, config }) => {
    const job = startTransactionScanJob(db, config, principal.userId, body);
    return ActionResult.accepted(job);
};

export const transactionScanProgressHandler: SubscriptionHandler<
    typeof TransactionScanProgressEndpoint
> = async function* ({ query, signal }) {
    yield* subscribeTransactionScanJob(query, signal);
};

export const transactionScanJobStatusHandler: Handler<
    typeof TransactionScanJobStatusEndpoint
> = async ({ query }) => {
    return ActionResult.ok(getTransactionScanJobStatus(query));
};

export const decideTransactionScanItemHandler: Handler<
    typeof DecideTransactionScanItemEndpoint
> = async ({ body, params, principal }, { db }) => {
    try {
        await recordTransactionScanDecision(
            db,
            principal.userId,
            params.scanId,
            params.itemId,
            body
        );
        return ActionResult.noContent();
    } catch (err) {
        const result = budgetResult(err);
        if (result) {
            return result;
        }
        if (err instanceof TransactionScanInputError) {
            return ActionResult.badRequest({ message: err.message });
        }
        if (err instanceof TransactionScanNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        throw err;
    }
};
