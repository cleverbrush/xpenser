/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import type { McpOAuthConnection } from '@xpenser/contracts';
import { describe, expect, it, vi } from 'vitest';
import { ApiKeysSettings } from './api-keys-settings';

vi.mock('@/lib/actions', () => ({
    createApiKeyAction: vi.fn(),
    revokeApiKeyAction: vi.fn(),
    revokeMcpOAuthConnectionAction: vi.fn()
}));

const connection: McpOAuthConnection = {
    id: 1,
    clientId: 'xpenser_mcp_client',
    clientName: 'Codex',
    createdAt: new Date('2026-06-01T12:00:00.000Z'),
    lastUsedAt: new Date('2026-06-02T12:00:00.000Z')
};

describe('ApiKeysSettings', () => {
    it('renders MCP setup instructions and active OAuth connections', () => {
        render(
            <ApiKeysSettings
                apiKeys={[]}
                mcpConnections={[connection]}
                mcpUrl="https://xpenser.example.com/external-api/mcp"
            />
        );

        expect(screen.getByText('MCP server')).toBeTruthy();
        expect(
            screen.getAllByText(/\/external-api\/mcp/).length
        ).toBeGreaterThan(0);
        expect(screen.getByText('Claude')).toBeTruthy();
        expect(screen.getAllByText('Codex').length).toBeGreaterThan(0);
        expect(screen.getByText('Cursor')).toBeTruthy();
        expect(screen.getByText('API key fallback')).toBeTruthy();
        expect(screen.getByText(/\[mcp_servers\.xpenser\]/)).toBeTruthy();
        expect(
            screen.getAllByText(/"type": "streamable-http"/).length
        ).toBeGreaterThan(0);
        expect(screen.getByText('xpenser_mcp_client')).toBeTruthy();
    });
});
