import { createErrors, decideErrors } from './errors.js';
import { createTransactionScanHandler } from './handlers/create.js';
import { decideTransactionScanItemHandler } from './handlers/decide.js';
import { transactionScanProgressHandler } from './handlers/progress.js';
import { startTransactionScanJobHandler } from './handlers/start.js';
import { transactionScanJobStatusHandler } from './handlers/status.js';
import { transactionScansScope } from './scope.js';

/** Bind transactionScans handlers once; the root verifies complete contract coverage. */
export const transactionScansModule = transactionScansScope.withHandlers({
    create: { handler: createTransactionScanHandler, errors: createErrors },
    start: startTransactionScanJobHandler,
    progress: transactionScanProgressHandler,
    status: transactionScanJobStatusHandler,
    decide: { handler: decideTransactionScanItemHandler, errors: decideErrors }
});
