/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiDocsPage } from './api-docs-page';

vi.mock('swagger-ui-react', () => ({
    default: (props: {
        readonly deepLinking?: boolean;
        readonly displayOperationId?: boolean;
        readonly filter?: boolean | string;
        readonly requestSnippetsEnabled?: boolean;
        readonly url?: string;
    }) =>
        createElement('div', {
            'data-deep-linking': String(props.deepLinking),
            'data-display-operation-id': String(props.displayOperationId),
            'data-filter': String(props.filter),
            'data-request-snippets-enabled': String(
                props.requestSnippetsEnabled
            ),
            'data-testid': 'swagger-ui',
            'data-url': props.url
        })
}));

describe('ApiDocsPage', () => {
    it('renders the public API docs page and embedded OpenAPI viewer', () => {
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
                .getAllByRole('link', { name: /Create hosted account/i })
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

        const swaggerUi = screen.getByTestId('swagger-ui');
        expect(swaggerUi.getAttribute('data-url')).toBe(
            '/external-api/openapi.json'
        );
        expect(swaggerUi.getAttribute('data-deep-linking')).toBe('true');
        expect(swaggerUi.getAttribute('data-display-operation-id')).toBe(
            'true'
        );
        expect(swaggerUi.getAttribute('data-filter')).toBe('true');
        expect(swaggerUi.getAttribute('data-request-snippets-enabled')).toBe(
            'true'
        );
    });
});
