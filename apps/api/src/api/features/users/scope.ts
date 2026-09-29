import { implement } from '@cleverbrush/server';
import { api } from '@xpenser/contracts';
import { ConfigToken, DbToken } from '../../../di/tokens.js';

/** Server-only configuration for the shared users contract. */
export const usersScope = implement(api).group('users', {
    inject: { db: DbToken },
    operations: {
        updatePreferences: {
            operationId: 'updateUserPreferences',
            tags: ['users'],
            description:
                'Updates the current user country, timezone, and email report preferences.',
            summary: 'Update preferences'
        },
        telegramStatus: {
            operationId: 'telegramConnectionStatus',
            tags: ['users'],
            description:
                'Returns Telegram linking status for the current user.',
            summary: 'Telegram connection status'
        },
        createTelegramLinkToken: {
            operationId: 'createTelegramLinkToken',
            tags: ['users'],
            description:
                'Creates a short-lived Telegram deep link for the current user.',
            summary: 'Create Telegram link token',
            inject: { config: ConfigToken }
        },
        disconnectTelegram: {
            operationId: 'disconnectTelegram',
            tags: ['users'],
            description: 'Disconnects Telegram from the current user.',
            summary: 'Disconnect Telegram'
        },
        updateAvatar: {
            operationId: 'updateUserAvatar',
            tags: ['users'],
            description:
                'Stores a manually uploaded avatar for the current user.',
            summary: 'Update user avatar'
        },
        deleteAvatar: {
            operationId: 'deleteUserAvatar',
            tags: ['users'],
            description: 'Removes the current user manually uploaded avatar.',
            summary: 'Delete user avatar'
        },
        avatarImage: {
            operationId: 'userAvatarImage',
            tags: ['users'],
            description:
                'Streams a stored avatar image visible to the current user.',
            summary: 'User avatar image'
        },
        listApiKeys: {
            operationId: 'listApiKeys',
            tags: ['api-keys'],
            description: 'Lists active API keys for the current user.',
            summary: 'List API keys'
        },
        createApiKey: {
            operationId: 'createApiKey',
            tags: ['api-keys'],
            description:
                'Creates a user API key and returns its plaintext secret once.',
            summary: 'Create API key'
        },
        revokeApiKey: {
            operationId: 'revokeApiKey',
            tags: ['api-keys'],
            description: 'Revokes an API key owned by the current user.',
            summary: 'Revoke API key'
        },
        listMcpOAuthConnections: {
            operationId: 'listMcpOAuthConnections',
            tags: ['mcp'],
            description:
                'Lists active MCP OAuth connections for the current user.',
            summary: 'List MCP connections'
        },
        revokeMcpOAuthConnection: {
            operationId: 'revokeMcpOAuthConnection',
            tags: ['mcp'],
            description:
                'Revokes an MCP OAuth connection owned by the current user.',
            summary: 'Revoke MCP connection'
        }
    }
});
