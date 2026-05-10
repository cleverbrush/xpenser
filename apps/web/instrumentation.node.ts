import { type OtelHandle, setupOtel } from '@cleverbrush/otel';

const globalForOtel = globalThis as typeof globalThis & {
    __xpenserWebOtel?: OtelHandle;
    __xpenserWebOtelShutdownRegistered?: boolean;
};

const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

const existingOtel = globalForOtel.__xpenserWebOtel;
export const otel =
    existingOtel ??
    setupOtel({
        serviceName: process.env.WEB_OTEL_SERVICE_NAME ?? 'xpenser-web',
        serviceVersion: process.env.npm_package_version,
        environment: process.env.NODE_ENV,
        otlpEndpoint: endpoint
    });

globalForOtel.__xpenserWebOtel = otel;

if (!globalForOtel.__xpenserWebOtelShutdownRegistered) {
    globalForOtel.__xpenserWebOtelShutdownRegistered = true;

    const shutdown = async () => {
        await otel.shutdown();
    };

    process.once('SIGTERM', () => {
        void shutdown();
    });
    process.once('SIGINT', () => {
        void shutdown();
    });
}
