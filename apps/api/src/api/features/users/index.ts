import {
    createTelegramLinkTokenErrors,
    revokeApiKeyErrors,
    revokeMcpOAuthConnectionErrors,
    updateAvatarErrors
} from './errors.js';
import { userAvatarImageHandler } from './handlers/avatar-image.js';
import { createApiKeyHandler } from './handlers/create-api-key.js';
import { createTelegramLinkTokenHandler } from './handlers/create-telegram-link-token.js';
import { deleteUserAvatarHandler } from './handlers/delete-avatar.js';
import { disconnectTelegramHandler } from './handlers/disconnect-telegram.js';
import { listApiKeysHandler } from './handlers/list-api-keys.js';
import { listMcpOAuthConnectionsHandler } from './handlers/list-mcp-o-auth-connections.js';
import { revokeApiKeyHandler } from './handlers/revoke-api-key.js';
import { revokeMcpOAuthConnectionHandler } from './handlers/revoke-mcp-o-auth-connection.js';
import { telegramStatusHandler } from './handlers/telegram-status.js';
import { updateUserAvatarHandler } from './handlers/update-avatar.js';
import { updatePreferencesHandler } from './handlers/update-preferences.js';
import { usersScope } from './scope.js';

/** Bind users handlers once; the root verifies complete contract coverage. */
export const usersModule = usersScope.withHandlers({
    updatePreferences: updatePreferencesHandler,
    telegramStatus: telegramStatusHandler,
    createTelegramLinkToken: {
        handler: createTelegramLinkTokenHandler,
        errors: createTelegramLinkTokenErrors
    },
    disconnectTelegram: disconnectTelegramHandler,
    updateAvatar: {
        handler: updateUserAvatarHandler,
        errors: updateAvatarErrors
    },
    deleteAvatar: deleteUserAvatarHandler,
    avatarImage: userAvatarImageHandler,
    listApiKeys: listApiKeysHandler,
    createApiKey: createApiKeyHandler,
    revokeApiKey: { handler: revokeApiKeyHandler, errors: revokeApiKeyErrors },
    listMcpOAuthConnections: listMcpOAuthConnectionsHandler,
    revokeMcpOAuthConnection: {
        handler: revokeMcpOAuthConnectionHandler,
        errors: revokeMcpOAuthConnectionErrors
    }
});
