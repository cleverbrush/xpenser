import type { Handler } from '@cleverbrush/server';
import { listTransactionTags } from '../../application/transaction-tags.js';
import type { ListTransactionTagsEndpoint } from '../endpoints.js';

export const listTransactionTagsHandler: Handler<
    typeof ListTransactionTagsEndpoint
> = async ({ query, principal }, { knex }) => {
    return listTransactionTags(knex, principal.userId, query);
};
