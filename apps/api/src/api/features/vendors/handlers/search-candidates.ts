import type { Handler } from '@cleverbrush/server';
import { searchVendorCandidates } from '../../../../application/vendors.js';
import type { vendorsScope } from '../scope.js';

/** Search vendors. */
export const searchVendorCandidatesHandler: Handler<
    typeof vendorsScope.endpoints.searchCandidates
> = async ({ query }, { config }) => {
    return searchVendorCandidates(config, query);
};
