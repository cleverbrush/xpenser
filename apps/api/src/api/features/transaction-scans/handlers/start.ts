import { ActionResult, type Handler } from '@cleverbrush/server';
import { uploadedImageData } from '../../../../application/upload-images.js';
import type { transactionScansScope } from '../scope.js';

/** Start transaction image scan. */
export const startTransactionScanJobHandler: Handler<
    typeof transactionScansScope.endpoints.start
> = async ({ body, files, principal }, { jobs }) => {
    const job = await jobs.start(principal.userId, {
        ...body,
        ...uploadedImageData(files.image)
    });
    return ActionResult.accepted(job);
};
