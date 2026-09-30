import { ActionResult, type Handler } from '@cleverbrush/server';
import { deleteTransaction } from '../../../../application/transactions.js';
import type { transactionsScope } from '../scope.js';

/** Delete transaction. */
export const deleteTransactionHandler: Handler<
    typeof transactionsScope.endpoints.delete
> = async ({ params, principal }, { db }) => {
    await deleteTransaction(db, principal.userId, params.id);
    return ActionResult.noContent();
};
