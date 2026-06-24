declare module 'swagger-ui-react' {
    import type { ComponentType } from 'react';

    type HttpMethod =
        | 'delete'
        | 'get'
        | 'head'
        | 'options'
        | 'patch'
        | 'post'
        | 'put'
        | 'trace';

    type RequestSnippetGenerator = {
        readonly syntax: string;
        readonly title: string;
    };

    type RequestSnippets = {
        readonly defaultExpanded?: boolean;
        readonly generators?: Record<string, RequestSnippetGenerator>;
        readonly languages?: readonly string[] | null;
    };

    type SwaggerUIProps = {
        readonly deepLinking?: boolean;
        readonly displayOperationId?: boolean;
        readonly displayRequestDuration?: boolean;
        readonly docExpansion?: 'full' | 'list' | 'none';
        readonly filter?: boolean | string;
        readonly requestSnippets?: RequestSnippets;
        readonly requestSnippetsEnabled?: boolean;
        readonly showCommonExtensions?: boolean;
        readonly supportedSubmitMethods?: readonly HttpMethod[];
        readonly tryItOutEnabled?: boolean;
        readonly url?: string;
    };

    const SwaggerUI: ComponentType<SwaggerUIProps>;

    export default SwaggerUI;
}
