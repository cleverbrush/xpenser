import { ActionResult, type Handler } from '@cleverbrush/server';
import {
    createVendor,
    getVendorDetails,
    listVendors,
    retryVendorEnrichment,
    searchVendorCandidates,
    updateVendor,
    VendorMetadataError,
    VendorNameError,
    VendorNotFoundError
} from '../../application/vendors.js';
import type {
    CreateVendorEndpoint,
    EnrichVendorEndpoint,
    GetVendorEndpoint,
    ListVendorsEndpoint,
    SearchVendorCandidatesEndpoint,
    UpdateVendorEndpoint
} from '../endpoints.js';

export const searchVendorCandidatesHandler: Handler<
    typeof SearchVendorCandidatesEndpoint
> = async ({ query }, { config }) => {
    return searchVendorCandidates(config, query);
};

export const listVendorsHandler: Handler<typeof ListVendorsEndpoint> = async (
    { query, principal },
    { db }
) => {
    return listVendors(db, principal.userId, query);
};

export const getVendorHandler: Handler<typeof GetVendorEndpoint> = async (
    { params, principal },
    { db }
) => {
    try {
        return await getVendorDetails(db, principal.userId, params.id);
    } catch (err) {
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
        if (err instanceof VendorNameError) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};

export const updateVendorHandler: Handler<typeof UpdateVendorEndpoint> = async (
    { body, params, principal },
    { db }
) => {
    try {
        return await updateVendor(db, principal.userId, params.id, body);
    } catch (err) {
        if (err instanceof VendorNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        if (
            err instanceof VendorNameError ||
            err instanceof VendorMetadataError
        ) {
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
        if (err instanceof VendorNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        throw err;
    }
};
