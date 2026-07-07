import type { Handler } from '@cleverbrush/server';
import { ActionResult } from '@cleverbrush/server';
import {
    BudgetAccessError,
    BudgetPermissionError
} from '../../application/budgets.js';
import { listTransactionTags } from '../../application/transaction-tags.js';
import type { ListTransactionTagsEndpoint } from '../endpoints.js';

export const listTransactionTagsHandler: Handler<
    typeof ListTransactionTagsEndpoint
> = async ({ query, principal }, { db }) => {
    try {
        return await listTransactionTags(db, principal.userId, query);
    } catch (err) {
        if (err instanceof BudgetPermissionError) {
            return ActionResult.forbidden({ message: err.message });
        }
        if (err instanceof BudgetAccessError) {
            return ActionResult.notFound({ message: err.message });
        }
        throw err;
    }
};
