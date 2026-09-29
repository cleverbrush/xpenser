import { implement } from '@cleverbrush/server';
import { api } from '@xpenser/contracts';
import { ConfigToken, DbToken, LoggerToken } from '../../../di/tokens.js';

/** Server-only configuration for the shared currencies contract. */
export const currenciesScope = implement(api).group('currencies', {
    inject: { config: ConfigToken },
    tags: ['currencies'],
    operations: {
        list: {
            operationId: 'listCurrencies',
            description:
                'Returns the live Frankfurter currency list, or a bundled full fallback catalog when Frankfurter is unavailable.',
            summary: 'List currencies',
            inject: { logger: LoggerToken }
        },
        convert: {
            operationId: 'convertCurrency',
            description:
                'Converts an entered amount to the selected budget default currency.',
            summary: 'Convert currency',
            inject: { db: DbToken }
        }
    }
});
