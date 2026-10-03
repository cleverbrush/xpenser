import { ActionResult, type Handler } from '@cleverbrush/server';
import { uploadTransactionScanImage } from '../../../../application/transaction-scans.js';
import { uploadedImageData } from '../../../../application/upload-images.js';
import type { transactionScansScope } from '../scope.js';

/** Store the original image independently of JSON review decisions. */
export const uploadTransactionScanImageHandler: Handler<
    typeof transactionScansScope.endpoints.uploadImage
> = async ({ files, params, principal }, { db }) => {
    await uploadTransactionScanImage(
        db,
        principal.userId,
        params.scanId,
        uploadedImageData(files.image)
    );
    return ActionResult.noContent();
};
