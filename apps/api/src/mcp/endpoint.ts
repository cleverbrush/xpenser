import { ActionResult, endpoint, type Handler } from '@cleverbrush/server';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { PrincipalSchema } from '@xpenser/contracts';
import { DbToken, LoggerToken } from '../di/tokens.js';
import { McpTransportError } from '../log-templates.js';
import { requireMcpApiKeyPrincipal } from './auth.js';
import { createXpenserMcpServer } from './server.js';

export const McpEndpoint = endpoint
    .post('/api/mcp')
    .authorize(PrincipalSchema)
    .inject({ db: DbToken, logger: LoggerToken })
    .summary('MCP server')
    .description('Read-only xpenser MCP server for AI agents.')
    .tags('mcp')
    .operationId('xpenserMcp');

export const mcpHandler: Handler<typeof McpEndpoint> = async (
    { context, principal },
    { db, logger }
) => {
    let apiKeyPrincipal: ReturnType<typeof requireMcpApiKeyPrincipal>;
    try {
        apiKeyPrincipal = requireMcpApiKeyPrincipal(principal);
    } catch (err) {
        if (err instanceof Error) {
            return ActionResult.unauthorized({ message: err.message });
        }
        throw err;
    }

    const mcpServer = createXpenserMcpServer({
        db,
        logger,
        principal: apiKeyPrincipal
    });
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
    });

    transport.onerror = error => {
        logger.error(error, McpTransportError, {
            UserId: apiKeyPrincipal.userId
        });
    };
    context.response.on('close', () => {
        void transport.close();
    });

    try {
        await mcpServer.connect(transport);
        await transport.handleRequest(context.request, context.response);
        context.responded = true;
        return undefined;
    } catch (err) {
        if (context.response.headersSent || context.response.writableEnded) {
            context.responded = true;
            return undefined;
        }
        throw err;
    }
};
