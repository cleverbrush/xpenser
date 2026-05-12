import { setupOtel } from '@cleverbrush/otel';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';

const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4318';

export const otel = setupOtel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'xpenser-telegram-bot',
    serviceVersion: process.env.npm_package_version,
    environment: process.env.NODE_ENV,
    otlpEndpoint: endpoint,
    instrumentations: [
        new HttpInstrumentation({
            requireParentforOutgoingSpans: true
        }),
        new UndiciInstrumentation({
            requireParentforSpans: true
        }),
        new RuntimeNodeInstrumentation()
    ]
});
