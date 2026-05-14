import type { Logger } from '@cleverbrush/log';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { AppDb } from '../db/schemas.js';
import type { McpApiKeyPrincipal } from './auth.js';
import {
    createXpenserMcpDataAccess,
    registerXpenserMcpTools
} from './tools.js';

export type XpenserMcpServerOptions = {
    readonly db: AppDb;
    readonly logger: Logger;
    readonly principal: McpApiKeyPrincipal;
};

export function createXpenserMcpServer({
    db,
    logger,
    principal
}: XpenserMcpServerOptions): Server {
    const server = new Server({
        name: 'xpenser',
        version: '0.1.0'
    });

    registerXpenserMcpTools(server, {
        principal,
        logger,
        data: createXpenserMcpDataAccess(db)
    });

    return server;
}
