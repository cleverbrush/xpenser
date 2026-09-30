import type { Handler } from '@cleverbrush/server';
import { listTransactionTags } from '../../../../application/transaction-tags.js';
import type { transactionTagsScope } from '../scope.js';

/** List transaction tags. */
export const listTransactionTagsHandler: Handler<
    typeof transactionTagsScope.endpoints.list
> = async ({ query, principal }, { db }) => {
    return await listTransactionTags(db, principal.userId, query);
};
