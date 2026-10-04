import {
    requireBudgetPermission,
    resolveBudgetAccess
} from '../../../application/budgets.js';
import { budgetAccessErrors } from '../../errors/budget-access.js';
import {
    createErrors,
    deleteErrors,
    exportCsvErrors,
    updateErrors
} from './errors.js';
import { createTransactionHandler } from './handlers/create.js';
import { deleteTransactionHandler } from './handlers/delete.js';
import { exportTransactionsCsvHandler } from './handlers/export-csv.js';
import { listTransactionsHandler } from './handlers/list.js';
import { getTransactionScanImageHandler } from './handlers/scan-image.js';
import { updateTransactionHandler } from './handlers/update.js';
import { transactionsScope } from './scope.js';

/** Bind transactions handlers once; the root verifies complete contract coverage. */
export const transactionsModule = transactionsScope.withHandlers({
    list: { handler: listTransactionsHandler, errors: budgetAccessErrors },
    exportCsv: {
        handler: exportTransactionsCsvHandler,
        errors: exportCsvErrors
    },
    create: {
        prepare: async (request, { db }) => {
            const access = await resolveBudgetAccess(
                db,
                request.principal.userId,
                request.body.budgetId
            );
            requireBudgetPermission(access, 'canCreateTransactions');
            if (request.body.tags?.length)
                requireBudgetPermission(access, 'canManageTags');
            return {
                ...request,
                body: { ...request.body, budgetId: access.budget.id }
            };
        },
        idempotency: {
            scope: ({ principal, body }) => [principal.userId, body.budgetId!]
        },
        handler: createTransactionHandler,
        errors: createErrors
    },
    update: { handler: updateTransactionHandler, errors: updateErrors },
    delete: { handler: deleteTransactionHandler, errors: deleteErrors },
    scanImage: { handler: getTransactionScanImageHandler, errors: deleteErrors }
});
