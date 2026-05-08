import { createLogger, consoleSink } from '@cleverbrush/log';
import { otelLogSink, traceEnricher } from '@cleverbrush/otel';
import { config } from './config.js';

export const logger = createLogger({
  minimumLevel: config.logLevel as 'verbose' | 'debug' | 'information' | 'warning' | 'error' | 'fatal',
  sinks: [consoleSink({ theme: 'dark' }), otelLogSink()],
  enrichers: [traceEnricher()],
});
