import { ActionResult, type Handler } from '@cleverbrush/server';
import { createTransaction } from '../../../../application/transactions.js';
import { TransactionCreated } from '../../../../log-templates.js';
import { transactionBudgetItem } from '../../../transaction-idempotency.js';
import type { transactionsScope } from '../scope.js';

/** Create transaction. */
export const createTransactionHandler: Handler<
    typeof transactionsScope.endpoints.create
> = async ({ body, principal, context }, { db, config, logger }) => {
    const resolvedBudget = context.items.get(transactionBudgetItem);
    const transaction = await createTransaction(db, config, principal.userId, {
        ...body,
        budgetId:
            typeof resolvedBudget === 'number' ? resolvedBudget : body.budgetId
    });
    logger.info(TransactionCreated, {
        TransactionId: transaction.id,
        UserId: principal.userId
    });
    return ActionResult.created(
        transaction,
        `/api/transactions/${transaction.id}`
    );
};
