import { implement } from '@cleverbrush/server';
import { api } from '@xpenser/contracts';
import { ConfigToken, DbToken } from '../../../di/tokens.js';

/** Server-only configuration for the shared telegram contract. */
export const telegramScope = implement(api).group('telegram', {
    inject: { db: DbToken, config: ConfigToken },
    tags: ['telegram'],
    operations: {
        link: {
            operationId: 'linkTelegramAccount',
            description:
                'Consumes a Telegram deep link token from the bot service.',
            summary: 'Link Telegram account'
        },
        token: {
            operationId: 'telegramToken',
            description:
                'Exchanges a linked Telegram user for a short-lived API JWT.',
            summary: 'Telegram token exchange'
        }
    }
});
