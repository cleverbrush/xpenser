import type { Handler } from '@cleverbrush/server';
import { updateTransaction } from '../../../../application/transactions.js';
import type { transactionsScope } from '../scope.js';

/** Update transaction. */
export const updateTransactionHandler: Handler<
    typeof transactionsScope.endpoints.update
> = async ({ body, params, principal }, { db, config }) => {
    return await updateTransaction(
        db,
        config,
        principal.userId,
        params.id,
        body
    );
};
