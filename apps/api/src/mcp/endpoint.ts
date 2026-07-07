import { ActionResult, endpoint, type Handler } from '@cleverbrush/server';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ConfigToken, DbToken, KnexToken, LoggerToken } from '../di/tokens.js';
import { McpTransportError } from '../log-templates.js';
import { authenticateMcpPrincipal } from './auth.js';
import { createXpenserMcpServer } from './server.js';

export const McpEndpoint = endpoint
    .post('/api/mcp')
    .inject({
        config: ConfigToken,
        db: DbToken,
        knex: KnexToken,
        logger: LoggerToken
    })
    .summary('MCP server')
    .description('xpenser MCP server for AI agents.')
    .tags('mcp')
    .operationId('xpenserMcp');

export const mcpHandler: Handler<typeof McpEndpoint> = async (
    { context },
    { config, db, knex, logger }
) => {
    const principal = await authenticateMcpPrincipal({
        config,
        db,
        headers: context.headers
    });
    if (!principal) {
        context.response.setHeader(
            'WWW-Authenticate',
            `Bearer resource_metadata="${new URL(
                '/.well-known/oauth-protected-resource/api/mcp',
                config.app.url
            ).toString()}"`
        );
        return ActionResult.unauthorized({
            message: 'MCP access requires a xpenser API key or MCP OAuth token.'
        });
    }

    return ActionResult.raw(async (request, response) => {
        const mcpServer = createXpenserMcpServer({
            config,
            db,
            knex,
            logger,
            principal
        });
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined
        });

        transport.onerror = error => {
            logger.error(error, McpTransportError, {
                UserId: principal.userId
            });
        };
        response.on('close', () => {
            void transport.close();
        });

        try {
            await mcpServer.connect(transport);
            await transport.handleRequest(request, response);
        } catch (err) {
            if (response.headersSent || response.writableEnded) {
                return;
            }
            throw err;
        }
    });
};
