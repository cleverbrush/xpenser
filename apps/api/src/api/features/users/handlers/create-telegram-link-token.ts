import { ActionResult, type Handler } from '@cleverbrush/server';
import { createTelegramLinkToken } from '../../../../application/telegram.js';
import type { usersScope } from '../scope.js';

/** Create Telegram link token. */
export const createTelegramLinkTokenHandler: Handler<
    typeof usersScope.endpoints.createTelegramLinkToken
> = async ({ principal }, { db, config }) => {
    return ActionResult.created(
        await createTelegramLinkToken(db, config, principal.userId)
    );
};
