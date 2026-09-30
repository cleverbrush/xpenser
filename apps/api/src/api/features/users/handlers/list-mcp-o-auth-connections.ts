import type { Handler } from '@cleverbrush/server';
import { listMcpOAuthConnections } from '../../../../application/mcp-oauth.js';
import type { usersScope } from '../scope.js';

/** List MCP connections. */
export const listMcpOAuthConnectionsHandler: Handler<
    typeof usersScope.endpoints.listMcpOAuthConnections
> = async ({ principal }, { db }) => {
    return listMcpOAuthConnections(db, principal.userId);
};
