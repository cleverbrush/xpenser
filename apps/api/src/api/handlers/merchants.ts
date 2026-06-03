import { ActionResult, type Handler } from '@cleverbrush/server';
import {
    createMerchant,
    getMerchantDetails,
    listMerchants,
    MerchantMetadataError,
    MerchantNameError,
    MerchantNotFoundError,
    retryMerchantEnrichment,
    searchMerchantBrands,
    updateMerchant
} from '../../application/merchants.js';
import type {
    CreateMerchantEndpoint,
    EnrichMerchantEndpoint,
    GetMerchantEndpoint,
    ListMerchantsEndpoint,
    SearchMerchantBrandsEndpoint,
    UpdateMerchantEndpoint
} from '../endpoints.js';

export const searchMerchantBrandsHandler: Handler<
    typeof SearchMerchantBrandsEndpoint
> = async ({ query }, { config }) => {
    return searchMerchantBrands(config, query);
};

export const listMerchantsHandler: Handler<
    typeof ListMerchantsEndpoint
> = async ({ query, principal }, { db }) => {
    return listMerchants(db, principal.userId, query);
};

export const getMerchantHandler: Handler<typeof GetMerchantEndpoint> = async (
    { params, principal },
    { db }
) => {
    try {
        return await getMerchantDetails(db, principal.userId, params.id);
    } catch (err) {
        if (err instanceof MerchantNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        throw err;
    }
};

export const createMerchantHandler: Handler<
    typeof CreateMerchantEndpoint
> = async ({ body, principal }, { db, config }) => {
    try {
        return ActionResult.created(
            await createMerchant(db, config, principal.userId, body),
            '/api/merchants'
        );
    } catch (err) {
        if (err instanceof MerchantNameError) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};

export const updateMerchantHandler: Handler<
    typeof UpdateMerchantEndpoint
> = async ({ body, params, principal }, { db }) => {
    try {
        return await updateMerchant(db, principal.userId, params.id, body);
    } catch (err) {
        if (err instanceof MerchantNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        if (
            err instanceof MerchantNameError ||
            err instanceof MerchantMetadataError
        ) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};

export const enrichMerchantHandler: Handler<
    typeof EnrichMerchantEndpoint
> = async ({ params, principal }, { db, config }) => {
    try {
        return await retryMerchantEnrichment(
            db,
            config,
            principal.userId,
            params.id
        );
    } catch (err) {
        if (err instanceof MerchantNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        throw err;
    }
};
