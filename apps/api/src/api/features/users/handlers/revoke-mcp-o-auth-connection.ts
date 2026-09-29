import { ActionResult, type Handler } from '@cleverbrush/server';
import { revokeMcpOAuthConnection } from '../../../../application/mcp-oauth.js';
import type { usersScope } from '../scope.js';

/** Revoke MCP connection. */
export const revokeMcpOAuthConnectionHandler: Handler<
    typeof usersScope.endpoints.revokeMcpOAuthConnection
> = async ({ params, principal }, { db }) => {
    await revokeMcpOAuthConnection(db, principal.userId, params.id);
    return ActionResult.noContent();
};
