import { ActionResult, type Handler } from '@cleverbrush/server';
import { createTransaction } from '../../../../application/transactions.js';
import { TransactionCreated } from '../../../../log-templates.js';
import type { transactionsScope } from '../scope.js';

/** Create transaction. */
export const createTransactionHandler: Handler<
    typeof transactionsScope.endpoints.create
> = async ({ body, principal }, { db, config, logger }) => {
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
};
