import type { Handler } from '@cleverbrush/server';
import { listTransactions } from '../../../../application/transactions.js';
import type { transactionsScope } from '../scope.js';

/** List transactions. */
export const listTransactionsHandler: Handler<
    typeof transactionsScope.endpoints.list
> = async ({ query, principal }, { db, knex }) => {
    return await listTransactions(db, principal.userId, query, knex);
};
