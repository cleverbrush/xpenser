import {
    consoleSink,
    createLogger,
    hostnameEnricher,
    type Logger,
    processIdEnricher
} from '@cleverbrush/log';
import { otelLogSink, traceEnricher } from '@cleverbrush/otel';
import { webConfig } from './config';

const globalForLogger = globalThis as typeof globalThis & {
    __xpenserWebLogger?: Logger;
};

export const logger =
    globalForLogger.__xpenserWebLogger ??
    createLogger({
        minimumLevel: webConfig.logLevel,
        sinks: [consoleSink({ theme: 'dark' }), otelLogSink()],
        enrichers: [
            hostnameEnricher(),
            processIdEnricher(),
            // Adds active request span IDs to log properties for trace/log correlation.
            traceEnricher()
        ],
        handleProcessExit: true
    });

globalForLogger.__xpenserWebLogger = logger;

export function loggerFor(sourceContext: string): Logger {
    return logger.forContext('SourceContext', sourceContext);
}
