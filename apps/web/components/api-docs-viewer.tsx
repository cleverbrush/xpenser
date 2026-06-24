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
                deepLinking
                displayOperationId
                displayRequestDuration
                docExpansion="list"
                filter
                requestSnippets={{
                    defaultExpanded: false,
                    generators: {
                        curl_bash: {
                            syntax: 'bash',
                            title: 'cURL'
                        }
                    },
                    languages: ['curl_bash']
                }}
                requestSnippetsEnabled
                showCommonExtensions
                supportedSubmitMethods={supportedSubmitMethods}
                url={openApiSpecPath}
            />
        </div>
    );
}
