import type { Handler } from '@cleverbrush/server';
import { getMcpOAuthAuthorizationRequest } from '../../../../application/mcp-oauth.js';
import type { oauthScope } from '../scope.js';

/** MCP OAuth authorization request. */
export const mcpOAuthAuthorizationRequestHandler: Handler<
    typeof oauthScope.endpoints.authorizationRequest
> = async ({ query }, { db }) => {
    return await getMcpOAuthAuthorizationRequest(db, query);
};
