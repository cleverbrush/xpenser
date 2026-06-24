/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiDocsPage } from './api-docs-page';

describe('ApiDocsPage', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                json: async () => ({
                    info: {
                        title: 'xpenser API',
                        version: '0.1.0'
                    },
                    openapi: '3.1.0',
                    paths: {
                        '/api/mcp': {
                            post: {
                                operationId: 'xpenserMcp',
                                responses: {
                                    '200': {
                                        description: 'OK'
                                    }
                                },
                                summary: 'MCP server',
                                tags: ['mcp']
                            }
                        },
                        '/api/transactions': {
                            get: {
                                operationId: 'listTransactions',
                                parameters: [
                                    {
                                        in: 'query',
                                        name: 'limit',
                                        schema: {
                                            type: 'integer'
                                        }
                                    }
                                ],
                                responses: {
                                    '200': {
                                        content: {
                                            'application/json': {
                                                schema: {
                                                    $ref: '#/components/schemas/TransactionListResponse'
                                                }
                                            }
                                        },
                                        description: 'OK'
                                    }
                                },
                                summary: 'List transactions',
                                tags: ['transactions']
                            }
                        }
                    },
                    servers: [
                        {
                            description: 'Configured API base URL',
                            url: 'https://xpenser.example.com/external-api'
                        }
                    ]
                }),
                ok: true
            })
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders the public API docs page and generated OpenAPI explorer', async () => {
        render(createElement(ApiDocsPage));

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /xpenser API reference/i
            })
        ).toBeTruthy();
        expect(
            screen.getByText(/generated xpenser OpenAPI reference/i)
        ).toBeTruthy();
        expect(
            screen
                .getAllByRole('link', { name: /Create account/i })
                .some(link => link.getAttribute('href') === '/register')
        ).toBe(true);
        expect(
            screen.getByRole('link', { name: /OpenAPI JSON/i })
        ).toHaveProperty(
            'href',
            'http://localhost:3000/external-api/openapi.json'
        );
        expect(
            screen.getByRole('link', { name: /API and MCP guide/i })
        ).toHaveProperty(
            'href',
            'http://localhost:3000/personal-finance-api-mcp'
        );
        expect(
            screen.getByRole('link', { name: /View source/i })
        ).toHaveProperty('href', 'https://github.com/cleverbrush/xpenser');

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                '/external-api/openapi.json',
                expect.objectContaining({
                    signal: expect.any(AbortSignal)
                })
            );
        });
        expect(
            await screen.findByRole('heading', {
                level: 2,
                name: 'xpenser API'
            })
        ).toBeTruthy();
        expect(screen.getByText(/OpenAPI 3\.1\.0/i)).toBeTruthy();
        expect(screen.getByLabelText(/Filter endpoints/i)).toHaveProperty(
            'type',
            'search'
        );
        expect(screen.getByText('/api/transactions')).toBeTruthy();
        expect(screen.getByText('List transactions')).toBeTruthy();
        expect(screen.getByText('listTransactions')).toBeTruthy();
        expect(screen.getByText('/api/mcp')).toBeTruthy();
        expect(screen.getByText('MCP server')).toBeTruthy();
        expect(
            screen.getByText(/https:\/\/xpenser\.example\.com\/external-api/i)
        ).toBeTruthy();
        expect(screen.queryByText(/Loading API reference/i)).toBeNull();
        expect(screen.getAllByText('Responses').length).toBeGreaterThan(0);
        expect(
            screen.getByText('OK - application/json (TransactionListResponse)')
        ).toBeTruthy();
        expect(screen.getByText('optional - integer')).toBeTruthy();
    });

    it('shows an error when the OpenAPI contract cannot load', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 500
            })
        );

        render(createElement(ApiDocsPage));

        expect(
            await screen.findByText('OpenAPI request failed: 500')
        ).toBeTruthy();
    });

    it('filters endpoints in the generated explorer', async () => {
        render(createElement(ApiDocsPage));

        const filter = await screen.findByLabelText(/Filter endpoints/i);
        expect(screen.getByText('/api/transactions')).toBeTruthy();
        expect(screen.getByText('/api/mcp')).toBeTruthy();

        fireEvent.change(filter, {
            target: {
                value: 'mcp'
            }
        });

        await waitFor(() => {
            expect(screen.queryByText('/api/transactions')).toBeNull();
        });
        expect(screen.getByText('/api/mcp')).toBeTruthy();
    });
});
