import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { RawResult } from '@cleverbrush/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mcpHandler } from './endpoint.js';

type TestResponse = EventEmitter & {
    headersSent: boolean;
    setHeader: ReturnType<typeof vi.fn>;
    writableEnded: boolean;
};

const mcpMocks = vi.hoisted(() => ({
    authenticateMcpPrincipal: vi.fn(),
    close: vi.fn(),
    connect: vi.fn(),
    createXpenserMcpServer: vi.fn(),
    handleRequest: vi.fn(),
    StreamableHTTPServerTransport: vi.fn()
}));

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
    StreamableHTTPServerTransport: mcpMocks.StreamableHTTPServerTransport
}));

vi.mock('./auth.js', () => ({
    authenticateMcpPrincipal: mcpMocks.authenticateMcpPrincipal
}));

vi.mock('./server.js', () => ({
    createXpenserMcpServer: mcpMocks.createXpenserMcpServer
}));

function responseStub(): TestResponse {
    const response = new EventEmitter() as TestResponse;
    response.headersSent = false;
    response.writableEnded = false;
    response.setHeader = vi.fn();
    return response;
}

describe('MCP endpoint', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mcpMocks.authenticateMcpPrincipal.mockResolvedValue({
            userId: 7,
            role: 'user',
            authType: 'api_key',
            apiKeyId: 42
        });
        mcpMocks.StreamableHTTPServerTransport.mockImplementation(
            function (this: {
                close: typeof mcpMocks.close;
                handleRequest: typeof mcpMocks.handleRequest;
            }) {
                this.close = mcpMocks.close;
                this.handleRequest = mcpMocks.handleRequest;
            }
        );
        mcpMocks.createXpenserMcpServer.mockReturnValue({
            connect: mcpMocks.connect
        });
    });

    it('returns a raw action result for authenticated MCP transport requests', async () => {
        const request = {} as IncomingMessage;
        const response = responseStub();
        const logger = { error: vi.fn() };

        const result = await mcpHandler(
            {
                context: {
                    headers: { authorization: 'Bearer token' },
                    request,
                    response: response as unknown as ServerResponse
                }
            } as never,
            {
                config: { app: { url: 'https://xpenser.example.com' } },
                db: {},
                knex: {},
                logger
            } as never
        );

        expect(result).toBeInstanceOf(RawResult);

        const rawResult = result as RawResult;
        await rawResult.executeAsync(
            request,
            response as unknown as ServerResponse,
            {} as never
        );

        expect(mcpMocks.connect).toHaveBeenCalledWith(
            expect.objectContaining({
                handleRequest: mcpMocks.handleRequest
            })
        );
        expect(mcpMocks.handleRequest).toHaveBeenCalledWith(request, response);

        response.emit('close');
        expect(mcpMocks.close).toHaveBeenCalled();
    });
});
