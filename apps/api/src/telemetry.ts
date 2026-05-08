import { setupOtel } from '@cleverbrush/otel';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node';

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4318';

export const otel = setupOtel({
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'xpenser-api',
  serviceVersion: process.env.npm_package_version,
  environment: process.env.NODE_ENV,
  otlpEndpoint: endpoint,
  instrumentations: [
    new HttpInstrumentation(),
    new UndiciInstrumentation(),
    new RuntimeNodeInstrumentation(),
  ],
});
