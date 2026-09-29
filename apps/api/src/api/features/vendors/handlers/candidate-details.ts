import { ActionResult, type Handler } from '@cleverbrush/server';
import { getVendorCandidateDetails } from '../../../../application/vendors.js';
import type { vendorsScope } from '../scope.js';

/** Get vendor candidate details. */
export const getVendorCandidateDetailsHandler: Handler<
    typeof vendorsScope.endpoints.candidateDetails
> = async ({ query }, { config }) => {
    const details = await getVendorCandidateDetails(config, query);
    if (!details) {
        return ActionResult.notFound({
            message: 'Vendor candidate details were not found.'
        });
    }
    return details;
};
