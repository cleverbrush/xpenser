'use client';

import SwaggerUI from 'swagger-ui-react';
import { openApiSpecPath } from '@/lib/public-site';

const supportedSubmitMethods = [
    'delete',
    'get',
    'patch',
    'post',
    'put'
] as const;

export function ApiDocsViewer() {
    return (
        <div
            className="api-docs-viewer overflow-hidden rounded-lg border bg-background"
            data-testid="api-docs-viewer"
        >
            <SwaggerUI
                defaultModelExpandDepth={-1}
                defaultModelsExpandDepth={-1}
                deepLinking
                displayOperationId
                displayRequestDuration
                docExpansion="list"
                filter
                supportedSubmitMethods={supportedSubmitMethods}
                url={openApiSpecPath}
            />
        </div>
    );
}
