import type { Handler } from '@cleverbrush/server';
import { listCurrencies } from '../../application/currencies.js';
import type { ListCurrenciesEndpoint } from '../endpoints.js';

export const listCurrenciesHandler: Handler<
    typeof ListCurrenciesEndpoint
> = async (_ctx, { config, logger }) => {
    return listCurrencies(config, logger);
};
