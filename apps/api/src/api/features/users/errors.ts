import { ActionResult, errorMap } from '@cleverbrush/server';
import { ApiKeyNotFoundError } from '../../../application/api-keys.js';
import { McpOAuthConnectionNotFoundError } from '../../../application/mcp-oauth.js';
import { TelegramNotConfiguredError } from '../../../application/telegram.js';
import { UserAvatarError } from '../../../application/user-avatars.js';

/** Preserve the expected errors handled by users.createTelegramLinkToken. */
export const createTelegramLinkTokenErrors = errorMap().on(
    TelegramNotConfiguredError,
    err => ActionResult.badRequest({ message: err.message })
);

/** Preserve the expected errors handled by users.updateAvatar. */
export const updateAvatarErrors = errorMap().on(UserAvatarError, err =>
    ActionResult.badRequest({ message: err.message })
);

/** Preserve the expected errors handled by users.revokeApiKey. */
export const revokeApiKeyErrors = errorMap().on(ApiKeyNotFoundError, err =>
    ActionResult.notFound({ message: err.message })
);

/** Preserve the expected errors handled by users.revokeMcpOAuthConnection. */
export const revokeMcpOAuthConnectionErrors = errorMap().on(
    McpOAuthConnectionNotFoundError,
    err => ActionResult.notFound({ message: err.message })
);
