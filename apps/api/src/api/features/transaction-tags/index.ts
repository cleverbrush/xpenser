import { budgetAccessErrors } from '../../errors/budget-access.js';
import { listTransactionTagsHandler } from './handlers/list.js';
import { transactionTagsScope } from './scope.js';

/** Bind transactionTags handlers once; the root verifies complete contract coverage. */
export const transactionTagsModule = transactionTagsScope.withHandlers({
    list: { handler: listTransactionTagsHandler, errors: budgetAccessErrors }
});
