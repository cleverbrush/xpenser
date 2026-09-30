import type { Handler } from '@cleverbrush/server';
import { getTelegramConnectionStatus } from '../../../../application/telegram.js';
import type { usersScope } from '../scope.js';

/** Telegram connection status. */
export const telegramStatusHandler: Handler<
    typeof usersScope.endpoints.telegramStatus
> = async ({ principal }, { db }) => {
    return getTelegramConnectionStatus(db, principal.userId);
};
