import type { Handler } from '@cleverbrush/server';
import { getVendorDetails } from '../../../../application/vendors.js';
import type { vendorsScope } from '../scope.js';

/** Get vendor. */
export const getVendorHandler: Handler<
    typeof vendorsScope.endpoints.get
> = async ({ params, principal }, { db }) => {
    return await getVendorDetails(db, principal.userId, params.id);
};
