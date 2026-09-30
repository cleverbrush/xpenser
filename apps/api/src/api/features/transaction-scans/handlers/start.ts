import { ActionResult, type Handler } from '@cleverbrush/server';
import { startTransactionScanJob } from '../../../../application/transaction-scan-jobs.js';
import type { transactionScansScope } from '../scope.js';

/** Start transaction image scan. */
export const startTransactionScanJobHandler: Handler<
    typeof transactionScansScope.endpoints.start
> = async ({ body, principal }, { db, config }) => {
    const job = startTransactionScanJob(db, config, principal.userId, body);
    return ActionResult.accepted(job);
};
