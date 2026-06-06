import type { Logger } from '@cleverbrush/log';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Knex } from 'knex';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';
import type { McpApiKeyPrincipal } from './auth.js';
import {
    createXpenserMcpDataAccess,
    registerXpenserMcpTools
} from './tools.js';

export type XpenserMcpServerOptions = {
    readonly config: Config;
    readonly db: AppDb;
    readonly knex: Knex;
    readonly logger: Logger;
    readonly principal: McpApiKeyPrincipal;
};

export function createXpenserMcpServer({
    config,
    db,
    knex,
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
        data: createXpenserMcpDataAccess(db, config, knex)
    });

    return server;
}
