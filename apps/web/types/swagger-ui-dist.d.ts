declare module 'swagger-ui-dist/swagger-ui-bundle' {
    type SwaggerUiConfig = {
        readonly deepLinking?: boolean;
        readonly displayOperationId?: boolean;
        readonly dom_id: string;
        readonly layout?: string;
        readonly persistAuthorization?: boolean;
        readonly plugins?: readonly unknown[];
        readonly presets?: readonly unknown[];
        readonly tryItOutEnabled?: boolean;
        readonly url: string;
    };

    type SwaggerUiBundle = {
        (config: SwaggerUiConfig): unknown;
        readonly plugins: {
            readonly DownloadUrl: unknown;
        };
        readonly presets: {
            readonly apis: unknown;
        };
    };

    const SwaggerUIBundle: SwaggerUiBundle;
    export default SwaggerUIBundle;
}

declare module 'swagger-ui-dist/swagger-ui-standalone-preset' {
    const SwaggerUIStandalonePreset: unknown;
    export default SwaggerUIStandalonePreset;
}
