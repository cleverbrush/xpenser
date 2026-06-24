/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./swagger-ui-viewer', () => ({
    SwaggerUiViewer: () => (
        <div data-testid="swagger-ui-viewer">Swagger UI viewer</div>
    )
}));

import { SwaggerDocsPage } from './swagger-docs-page';

describe('SwaggerDocsPage', () => {
    it('renders the dedicated Swagger UI page', () => {
        render(createElement(SwaggerDocsPage));

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /xpenser Swagger reference/i
            })
        ).toBeTruthy();
        expect(
            screen
                .getAllByRole('link', { name: /API docs/i })
                .some(
                    link =>
                        link.getAttribute('href') === '/api-docs' &&
                        link.textContent === 'API docs'
                )
        ).toBe(true);
        expect(
            screen.getByRole('link', { name: /OpenAPI JSON/i })
        ).toHaveProperty('href', 'http://localhost:3000/api/openapi.json');
        expect(screen.getByTestId('swagger-ui-viewer')).toBeTruthy();
    });
});
