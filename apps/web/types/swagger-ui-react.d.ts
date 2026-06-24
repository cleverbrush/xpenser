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

    type SwaggerUIProps = {
        readonly defaultModelExpandDepth?: number;
        readonly defaultModelsExpandDepth?: number;
        readonly deepLinking?: boolean;
        readonly displayOperationId?: boolean;
        readonly displayRequestDuration?: boolean;
        readonly docExpansion?: 'full' | 'list' | 'none';
        readonly filter?: boolean | string;
        readonly supportedSubmitMethods?: readonly HttpMethod[];
        readonly tryItOutEnabled?: boolean;
        readonly url?: string;
    };

    const SwaggerUI: ComponentType<SwaggerUIProps>;

    export default SwaggerUI;
}
