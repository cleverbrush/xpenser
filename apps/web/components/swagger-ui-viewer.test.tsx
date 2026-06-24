/**
 * @vitest-environment jsdom
 */

import { render, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

const swaggerMocks = vi.hoisted(() => ({
    bundle: Object.assign(vi.fn(), {
        plugins: {
            DownloadUrl: { name: 'DownloadUrl' }
        },
        presets: {
            apis: { name: 'apis' }
        }
    }),
    standalonePreset: { name: 'standalone' }
}));

vi.mock('swagger-ui-dist/swagger-ui-bundle', () => ({
    default: swaggerMocks.bundle
}));

vi.mock('swagger-ui-dist/swagger-ui-standalone-preset', () => ({
    default: swaggerMocks.standalonePreset
}));

import { SwaggerUiViewer } from './swagger-ui-viewer';

describe('SwaggerUiViewer', () => {
    it('initializes Swagger UI with the public OpenAPI document', async () => {
        render(createElement(SwaggerUiViewer));

        await waitFor(() => {
            expect(swaggerMocks.bundle).toHaveBeenCalledWith(
                expect.objectContaining({
                    deepLinking: true,
                    displayOperationId: true,
                    dom_id: '#xpenser-swagger-ui',
                    layout: 'StandaloneLayout',
                    persistAuthorization: true,
                    tryItOutEnabled: true,
                    url: '/api/openapi.json'
                })
            );
        });
    });
});
