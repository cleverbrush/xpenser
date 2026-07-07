import { ActionResult, type Handler } from '@cleverbrush/server';
import {
    BudgetAccessError,
    BudgetPermissionError
} from '../../application/budgets.js';
import {
    createVendor,
    getVendorCandidateDetails,
    getVendorDetails,
    listVendors,
    retryVendorEnrichment,
    searchVendorCandidates,
    updateVendor,
    VendorMetadataError,
    VendorNameError,
    VendorNotFoundError
} from '../../application/vendors.js';
import { VendorUpdateValidationRejected } from '../../log-templates.js';
import type {
    CreateVendorEndpoint,
    EnrichVendorEndpoint,
    GetVendorEndpoint,
    ListVendorsEndpoint,
    SearchVendorCandidatesEndpoint,
    UpdateVendorEndpoint,
    VendorCandidateDetailsEndpoint
} from '../endpoints.js';

function budgetResult(err: unknown) {
    if (err instanceof BudgetPermissionError) {
        return ActionResult.forbidden({ message: err.message });
    }
    if (err instanceof BudgetAccessError) {
        return ActionResult.notFound({ message: err.message });
    }
    return undefined;
}

export const searchVendorCandidatesHandler: Handler<
    typeof SearchVendorCandidatesEndpoint
> = async ({ query }, { config }) => {
    return searchVendorCandidates(config, query);
};

export const getVendorCandidateDetailsHandler: Handler<
    typeof VendorCandidateDetailsEndpoint
> = async ({ query }, { config }) => {
    const details = await getVendorCandidateDetails(config, query);
    if (!details) {
        return ActionResult.notFound({
            message: 'Vendor candidate details were not found.'
        });
    }
    return details;
};

export const listVendorsHandler: Handler<typeof ListVendorsEndpoint> = async (
    { query, principal },
    { db }
) => {
    try {
        return await listVendors(db, principal.userId, query);
    } catch (err) {
        const result = budgetResult(err);
        if (result) {
            return result;
        }
        throw err;
    }
};

export const getVendorHandler: Handler<typeof GetVendorEndpoint> = async (
    { params, principal },
    { db }
) => {
    try {
        return await getVendorDetails(db, principal.userId, params.id);
    } catch (err) {
        const result = budgetResult(err);
        if (result) {
            return result;
        }
        if (err instanceof VendorNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        throw err;
    }
};

export const createVendorHandler: Handler<typeof CreateVendorEndpoint> = async (
    { body, principal },
    { db, config }
) => {
    try {
        return ActionResult.created(
            await createVendor(db, config, principal.userId, body),
            '/api/vendors'
        );
    } catch (err) {
        const result = budgetResult(err);
        if (result) {
            return result;
        }
        if (err instanceof VendorNameError) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};

export const updateVendorHandler: Handler<typeof UpdateVendorEndpoint> = async (
    { body, params, principal },
    { db, logger }
) => {
    try {
        return await updateVendor(db, principal.userId, params.id, body);
    } catch (err) {
        const result = budgetResult(err);
        if (result) {
            return result;
        }
        if (err instanceof VendorNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        if (
            err instanceof VendorNameError ||
            err instanceof VendorMetadataError
        ) {
            logger.warn(VendorUpdateValidationRejected, {
                Reason: err.message,
                UserId: principal.userId,
                VendorId: params.id
            });
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};

export const enrichVendorHandler: Handler<typeof EnrichVendorEndpoint> = async (
    { params, principal },
    { db, config }
) => {
    try {
        return await retryVendorEnrichment(
            db,
            config,
            principal.userId,
            params.id
        );
    } catch (err) {
        const result = budgetResult(err);
        if (result) {
            return result;
        }
        if (err instanceof VendorNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        throw err;
    }
};
