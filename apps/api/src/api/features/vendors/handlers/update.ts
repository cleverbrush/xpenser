import type { Handler } from '@cleverbrush/server';
import {
    updateVendor,
    VendorMetadataError,
    VendorNameError
} from '../../../../application/vendors.js';
import { VendorUpdateValidationRejected } from '../../../../log-templates.js';
import type { vendorsScope } from '../scope.js';

/** Update vendor. */
export const updateVendorHandler: Handler<
    typeof vendorsScope.endpoints.update
> = async ({ body, params, principal }, { db, logger }) => {
    try {
        return await updateVendor(db, principal.userId, params.id, body);
    } catch (err) {
        if (
            err instanceof VendorNameError ||
            err instanceof VendorMetadataError
        ) {
            logger.warn(VendorUpdateValidationRejected, {
                Reason: err.message,
                UserId: principal.userId,
                VendorId: params.id
            });
        }
        throw err;
    }
};
