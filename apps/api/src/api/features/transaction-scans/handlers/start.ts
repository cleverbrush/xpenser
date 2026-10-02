import { ActionResult, type Handler } from '@cleverbrush/server';
import type { transactionScansScope } from '../scope.js';

/** Start transaction image scan. */
export const startTransactionScanJobHandler: Handler<
    typeof transactionScansScope.endpoints.start
> = async ({ body, principal }, { jobs }) => {
    const job = await jobs.start(principal.userId, body);
    return ActionResult.accepted(job);
};
