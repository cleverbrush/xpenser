import { ActionResult, type Handler } from '@cleverbrush/server';
import { createVendor } from '../../../../application/vendors.js';
import type { vendorsScope } from '../scope.js';

/** Create vendor. */
export const createVendorHandler: Handler<
    typeof vendorsScope.endpoints.create
> = async ({ body, principal }, { db, config }) => {
    return ActionResult.created(
        await createVendor(db, config, principal.userId, body),
        '/api/vendors'
    );
};
