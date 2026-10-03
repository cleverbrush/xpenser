import { ActionResult, type Handler } from '@cleverbrush/server';
import { scanTransactionsFromImage } from '../../../../application/transaction-scans.js';
import { uploadedImageData } from '../../../../application/upload-images.js';
import type { transactionScansScope } from '../scope.js';

/** Scan transaction image. */
export const createTransactionScanHandler: Handler<
    typeof transactionScansScope.endpoints.create
> = async ({ body, files, principal }, { db, config }) => {
    const scan = await scanTransactionsFromImage(db, config, principal.userId, {
        ...body,
        ...uploadedImageData(files.image)
    });
    return ActionResult.created(scan, `/api/transaction-scans/${scan.scanId}`);
};
