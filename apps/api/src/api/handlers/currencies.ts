import type { Handler } from '@cleverbrush/server';
import {
    convertCurrencyForUser,
    listCurrencies
} from '../../application/currencies.js';
import type {
    ConvertCurrencyEndpoint,
    ListCurrenciesEndpoint
} from '../endpoints.js';

export const listCurrenciesHandler: Handler<
    typeof ListCurrenciesEndpoint
> = async (_ctx, { config, logger }) => {
    return listCurrencies(config, logger);
};

export const convertCurrencyHandler: Handler<
    typeof ConvertCurrencyEndpoint
> = async ({ principal, query }, { db, config }) => {
    return convertCurrencyForUser(db, config, principal.userId, query);
};
