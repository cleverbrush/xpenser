import { budgetAccessErrors } from '../../errors/budget-access.js';
import { createErrors, getErrors, updateErrors } from './errors.js';
import { getVendorCandidateDetailsHandler } from './handlers/candidate-details.js';
import { createVendorHandler } from './handlers/create.js';
import { enrichVendorHandler } from './handlers/enrich.js';
import { getVendorHandler } from './handlers/get.js';
import { listVendorsHandler } from './handlers/list.js';
import { searchVendorCandidatesHandler } from './handlers/search-candidates.js';
import { updateVendorHandler } from './handlers/update.js';
import { vendorsScope } from './scope.js';

/** Bind vendors handlers once; the root verifies complete contract coverage. */
export const vendorsModule = vendorsScope.withHandlers({
    searchCandidates: searchVendorCandidatesHandler,
    candidateDetails: getVendorCandidateDetailsHandler,
    list: { handler: listVendorsHandler, errors: budgetAccessErrors },
    get: { handler: getVendorHandler, errors: getErrors },
    create: { handler: createVendorHandler, errors: createErrors },
    update: { handler: updateVendorHandler, errors: updateErrors },
    enrich: { handler: enrichVendorHandler, errors: getErrors }
});
