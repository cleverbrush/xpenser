import { implement } from '@cleverbrush/server';
import { api } from '@xpenser/contracts';
import { DbToken } from '../../../di/tokens.js';

/** Server-only configuration for the shared oauth contract. */
export const oauthScope = implement(api).group('oauth', {
    inject: { db: DbToken },
    tags: ['mcp'],
    operations: {
        authorizationRequest: {
            operationId: 'mcpOAuthAuthorizationRequest',
            description:
                'Validates an MCP OAuth authorization request before user approval.',
            summary: 'MCP OAuth authorization request'
        },
        authorize: {
            operationId: 'mcpOAuthAuthorize',
            description:
                'Approves an MCP OAuth authorization request for the user.',
            summary: 'Approve MCP OAuth'
        }
    }
});
