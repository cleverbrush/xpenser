/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiDocsPage } from './api-docs-page';

describe('ApiDocsPage', () => {
    it('renders the public API docs page and Swagger entry points', () => {
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
                .getAllByRole('link', { name: /Open Swagger UI/i })
                .every(
                    link => link.getAttribute('href') === '/api-docs/swagger'
                )
        ).toBe(true);
        expect(
            screen
                .getAllByRole('link', { name: /Create account/i })
                .some(link => link.getAttribute('href') === '/register')
        ).toBe(true);
        expect(
            screen.getByRole('link', { name: /OpenAPI JSON/i })
        ).toHaveProperty('href', 'http://localhost:3000/api/openapi.json');
        expect(
            screen.getByRole('link', { name: /API and MCP guide/i })
        ).toHaveProperty(
            'href',
            'http://localhost:3000/personal-finance-api-mcp'
        );
        expect(
            screen.getByRole('link', { name: /View source/i })
        ).toHaveProperty('href', 'https://github.com/cleverbrush/xpenser');
        expect(
            screen.getByText(/MCP Streamable HTTP endpoint at \/api\/mcp/i)
        ).toBeTruthy();
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: /Interactive Swagger reference/i
            })
        ).toBeTruthy();
    });
});
