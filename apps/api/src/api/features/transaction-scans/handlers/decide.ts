import { ActionResult, type Handler } from '@cleverbrush/server';
import { recordTransactionScanDecision } from '../../../../application/transaction-scans.js';
import type { transactionScansScope } from '../scope.js';

/** Record transaction scan decision. */
export const decideTransactionScanItemHandler: Handler<
    typeof transactionScansScope.endpoints.decide
> = async ({ body, params, principal }, { db }) => {
    await recordTransactionScanDecision(
        db,
        principal.userId,
        params.scanId,
        params.itemId,
        body
    );
    return ActionResult.noContent();
};
