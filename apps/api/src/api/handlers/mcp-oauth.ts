import { ActionResult, type Handler } from '@cleverbrush/server';
import {
    authorizeMcpOAuthRequest,
    getMcpOAuthAuthorizationRequest,
    listMcpOAuthConnections,
    McpOAuthConnectionNotFoundError,
    OAuthError,
    revokeMcpOAuthConnection
} from '../../application/mcp-oauth.js';
import type {
    ListMcpOAuthConnectionsEndpoint,
    McpOAuthAuthorizationRequestEndpoint,
    McpOAuthAuthorizeEndpoint,
    RevokeMcpOAuthConnectionEndpoint
} from '../endpoints.js';

export const listMcpOAuthConnectionsHandler: Handler<
    typeof ListMcpOAuthConnectionsEndpoint
> = async ({ principal }, { db }) => {
    return listMcpOAuthConnections(db, principal.userId);
};

export const revokeMcpOAuthConnectionHandler: Handler<
    typeof RevokeMcpOAuthConnectionEndpoint
> = async ({ params, principal }, { db }) => {
    try {
        await revokeMcpOAuthConnection(db, principal.userId, params.id);
        return ActionResult.noContent();
    } catch (err) {
        if (err instanceof McpOAuthConnectionNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        throw err;
    }
};

export const mcpOAuthAuthorizationRequestHandler: Handler<
    typeof McpOAuthAuthorizationRequestEndpoint
> = async ({ query }, { db }) => {
    try {
        return await getMcpOAuthAuthorizationRequest(db, query);
    } catch (err) {
        if (err instanceof OAuthError) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};

export const mcpOAuthAuthorizeHandler: Handler<
    typeof McpOAuthAuthorizeEndpoint
> = async ({ body, principal }, { db }) => {
    try {
        return await authorizeMcpOAuthRequest(db, principal.userId, body);
    } catch (err) {
        if (err instanceof OAuthError) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};
