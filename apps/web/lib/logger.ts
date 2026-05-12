import {
    consoleSink,
    createLogger,
    hostnameEnricher,
    type Logger,
    type LogLevelName,
    processIdEnricher
} from '@cleverbrush/log';
import { otelLogSink, traceEnricher } from '@cleverbrush/otel';

const LOG_LEVELS = [
    'trace',
    'debug',
    'information',
    'warning',
    'error',
    'fatal'
] as const;

const globalForLogger = globalThis as typeof globalThis & {
    __xpenserWebLogger?: Logger;
};

function configuredLogLevel(): LogLevelName {
    const level = process.env.LOG_LEVEL;
    return LOG_LEVELS.includes(level as LogLevelName)
        ? (level as LogLevelName)
        : 'information';
}

export const logger =
    globalForLogger.__xpenserWebLogger ??
    createLogger({
        minimumLevel: configuredLogLevel(),
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
