import type { Handler } from '@cleverbrush/server';
import { authorizeMcpOAuthRequest } from '../../../../application/mcp-oauth.js';
import type { oauthScope } from '../scope.js';

/** Approve MCP OAuth. */
export const mcpOAuthAuthorizeHandler: Handler<
    typeof oauthScope.endpoints.authorize
> = async ({ body, principal }, { db }) => {
    return await authorizeMcpOAuthRequest(db, principal.userId, body);
};
