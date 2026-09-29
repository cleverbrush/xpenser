import type { Handler } from '@cleverbrush/server';
import { listVendors } from '../../../../application/vendors.js';
import type { vendorsScope } from '../scope.js';

/** List vendors. */
export const listVendorsHandler: Handler<
    typeof vendorsScope.endpoints.list
> = async ({ query, principal }, { db }) => {
    return await listVendors(db, principal.userId, query);
};
