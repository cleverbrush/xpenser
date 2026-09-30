import type { Handler } from '@cleverbrush/server';
import {
    issueTelegramUserToken,
    verifyTelegramServiceSecret
} from '../../../../application/telegram.js';
import { unauthorizedBot } from '../guards.js';
import type { telegramScope } from '../scope.js';

/** Telegram token exchange. */
export const telegramTokenHandler: Handler<
    typeof telegramScope.endpoints.token
> = async ({ body, context }, { db, config }) => {
    if (
        !verifyTelegramServiceSecret(
            config,
            context.headers['x-xpenser-bot-secret']
        )
    ) {
        return unauthorizedBot();
    }

    return await issueTelegramUserToken(db, config, body.telegramUser);
};
