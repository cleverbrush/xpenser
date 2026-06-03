import { ActionResult, type Handler } from '@cleverbrush/server';
import {
    createMerchant,
    listMerchants,
    MerchantNameError
} from '../../application/merchants.js';
import type {
    CreateMerchantEndpoint,
    ListMerchantsEndpoint
} from '../endpoints.js';

export const listMerchantsHandler: Handler<
    typeof ListMerchantsEndpoint
> = async ({ query, principal }, { db }) => {
    return listMerchants(db, principal.userId, query);
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
