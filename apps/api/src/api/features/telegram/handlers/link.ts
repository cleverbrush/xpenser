import type { Handler } from '@cleverbrush/server';
import {
    linkTelegramAccount,
    verifyTelegramServiceSecret
} from '../../../../application/telegram.js';
import { unauthorizedBot } from '../guards.js';
import type { telegramScope } from '../scope.js';

/** Link Telegram account. */
export const linkTelegramHandler: Handler<
    typeof telegramScope.endpoints.link
> = async ({ body, context }, { db, config }) => {
    if (
        !verifyTelegramServiceSecret(
            config,
            context.headers['x-xpenser-bot-secret']
        )
    ) {
        return unauthorizedBot();
    }

    return await linkTelegramAccount(db, body.token, body.telegramUser);
};
