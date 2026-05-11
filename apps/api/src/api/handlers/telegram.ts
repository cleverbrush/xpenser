import { ActionResult, type Handler } from '@cleverbrush/server';
import {
    createTelegramLinkToken,
    disconnectTelegramAccount,
    getTelegramConnectionStatus,
    issueTelegramUserToken,
    linkTelegramAccount,
    TelegramAccountConflictError,
    TelegramAccountNotLinkedError,
    TelegramLinkTokenInvalidError,
    TelegramNotConfiguredError,
    verifyTelegramServiceSecret
} from '../../application/telegram.js';
import type {
    CreateTelegramLinkTokenEndpoint,
    DisconnectTelegramEndpoint,
    LinkTelegramEndpoint,
    TelegramStatusEndpoint,
    TelegramTokenEndpoint
} from '../endpoints.js';

function unauthorizedBot() {
    return ActionResult.unauthorized({
        message: 'Invalid Telegram service credentials.'
    });
}

export const telegramStatusHandler: Handler<
    typeof TelegramStatusEndpoint
> = async ({ principal }, { db }) => {
    return getTelegramConnectionStatus(db, principal.userId);
};

export const createTelegramLinkTokenHandler: Handler<
    typeof CreateTelegramLinkTokenEndpoint
> = async ({ principal }, { db, config }) => {
    try {
        return ActionResult.created(
            await createTelegramLinkToken(db, config, principal.userId)
        );
    } catch (err) {
        if (err instanceof TelegramNotConfiguredError) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};

export const disconnectTelegramHandler: Handler<
    typeof DisconnectTelegramEndpoint
> = async ({ principal }, { db }) => {
    await disconnectTelegramAccount(db, principal.userId);
    return ActionResult.noContent();
};

export const linkTelegramHandler: Handler<typeof LinkTelegramEndpoint> = async (
    { body, context },
    { db, config }
) => {
    if (
        !verifyTelegramServiceSecret(
            config,
            context.headers['x-xpenser-bot-secret']
        )
    ) {
        return unauthorizedBot();
    }

    try {
        return await linkTelegramAccount(db, body.token, body.telegramUser);
    } catch (err) {
        if (err instanceof TelegramLinkTokenInvalidError) {
            return ActionResult.badRequest({ message: err.message });
        }
        if (err instanceof TelegramAccountConflictError) {
            return ActionResult.conflict({ message: err.message });
        }
        throw err;
    }
};

export const telegramTokenHandler: Handler<
    typeof TelegramTokenEndpoint
> = async ({ body, context }, { db, config }) => {
    if (
        !verifyTelegramServiceSecret(
            config,
            context.headers['x-xpenser-bot-secret']
        )
    ) {
        return unauthorizedBot();
    }

    try {
        return await issueTelegramUserToken(db, config, body.telegramUser);
    } catch (err) {
        if (err instanceof TelegramAccountNotLinkedError) {
            return ActionResult.unauthorized({ message: err.message });
        }
        throw err;
    }
};
