import type { Handler } from '@cleverbrush/server';
import { convertCurrencyForUser } from '../../../../application/currencies.js';
import type { currenciesScope } from '../scope.js';

/** Convert currency. */
export const convertCurrencyHandler: Handler<
    typeof currenciesScope.endpoints.convert
> = async ({ principal, query }, { db, config }) => {
    return convertCurrencyForUser(db, config, principal.userId, query);
};
