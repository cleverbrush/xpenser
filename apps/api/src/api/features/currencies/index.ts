import { convertCurrencyHandler } from './handlers/convert.js';
import { listCurrenciesHandler } from './handlers/list.js';
import { currenciesScope } from './scope.js';

/** Bind currencies handlers once; the root verifies complete contract coverage. */
export const currenciesModule = currenciesScope.withHandlers({
    list: listCurrenciesHandler,
    convert: convertCurrencyHandler
});
