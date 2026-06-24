'use client';

import dynamic from 'next/dynamic';
import { openApiSpecPath } from '@/lib/public-site';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
    loading: () => (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Loading API reference...
        </div>
    ),
    ssr: false
});

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
