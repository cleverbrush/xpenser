import type { Handler } from '@cleverbrush/server';
import { listCurrencies } from '../../../../application/currencies.js';
import type { currenciesScope } from '../scope.js';

/** List currencies. */
export const listCurrenciesHandler: Handler<
    typeof currenciesScope.endpoints.list
> = async (_ctx, { config, logger }) => {
    return listCurrencies(config, logger);
};
