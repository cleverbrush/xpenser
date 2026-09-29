import { ActionResult, type Handler } from '@cleverbrush/server';
import { disconnectTelegramAccount } from '../../../../application/telegram.js';
import type { usersScope } from '../scope.js';

/** Disconnect Telegram. */
export const disconnectTelegramHandler: Handler<
    typeof usersScope.endpoints.disconnectTelegram
> = async ({ principal }, { db }) => {
    await disconnectTelegramAccount(db, principal.userId);
    return ActionResult.noContent();
};
