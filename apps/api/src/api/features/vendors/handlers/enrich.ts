import type { Handler } from '@cleverbrush/server';
import { retryVendorEnrichment } from '../../../../application/vendors.js';
import type { vendorsScope } from '../scope.js';

/** Retry vendor enrichment. */
export const enrichVendorHandler: Handler<
    typeof vendorsScope.endpoints.enrich
> = async ({ params, principal }, { db, config }) => {
    return await retryVendorEnrichment(db, config, principal.userId, params.id);
};
