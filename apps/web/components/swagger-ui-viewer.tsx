'use client';

import { useEffect } from 'react';
import { openApiSpecPath } from '@/lib/public-site';

const swaggerElementId = 'xpenser-swagger-ui';

export function SwaggerUiViewer() {
    useEffect(() => {
        let disposed = false;
        const element = document.getElementById(swaggerElementId);
        if (!element) {
            return;
        }
        element.innerHTML = '';
        void Promise.all([
            import('swagger-ui-dist/swagger-ui-bundle'),
            import('swagger-ui-dist/swagger-ui-standalone-preset')
        ]).then(
            ([
                { default: SwaggerUIBundle },
                { default: SwaggerUIStandalonePreset }
            ]) => {
                if (disposed) {
                    return;
                }
                SwaggerUIBundle({
                    deepLinking: true,
                    displayOperationId: true,
                    dom_id: `#${swaggerElementId}`,
                    layout: 'StandaloneLayout',
                    persistAuthorization: true,
                    plugins: [SwaggerUIBundle.plugins.DownloadUrl],
                    presets: [
                        SwaggerUIBundle.presets.apis,
                        SwaggerUIStandalonePreset
                    ],
                    tryItOutEnabled: true,
                    url: openApiSpecPath
                });
            }
        );
        return () => {
            disposed = true;
            element.innerHTML = '';
        };
    }, []);

    return (
        <div
            className="swagger-docs-viewer overflow-hidden rounded-lg border bg-background"
            data-testid="swagger-ui-viewer"
            id={swaggerElementId}
        />
    );
}
