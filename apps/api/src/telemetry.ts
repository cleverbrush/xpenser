import { setupOtel } from '@cleverbrush/otel';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';

const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4318';

function isHealthPath(url: string | undefined): boolean {
    if (!url) {
        return false;
    }

    try {
        return new URL(url, 'http://localhost').pathname === '/health';
    } catch {
        return false;
    }
}

export const otel = setupOtel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'xpenser-api',
    serviceVersion: process.env.npm_package_version,
    environment: process.env.NODE_ENV,
    otlpEndpoint: endpoint,
    instrumentations: [
        new HttpInstrumentation({
            ignoreIncomingRequestHook: request => isHealthPath(request.url)
        }),
        new UndiciInstrumentation(),
        new RuntimeNodeInstrumentation()
    ]
});
