import { ActionResult, type Handler } from '@cleverbrush/server';
import { scanTransactionsFromImage } from '../../../../application/transaction-scans.js';
import type { transactionScansScope } from '../scope.js';

/** Scan transaction image. */
export const createTransactionScanHandler: Handler<
    typeof transactionScansScope.endpoints.create
> = async ({ body, principal }, { db, config }) => {
    const scan = await scanTransactionsFromImage(
        db,
        config,
        principal.userId,
        body
    );
    return ActionResult.created(scan, `/api/transaction-scans/${scan.scanId}`);
};
