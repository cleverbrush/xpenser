import {
    consoleSink,
    createLogger,
    hostnameEnricher,
    processIdEnricher
} from '@cleverbrush/log';
import { otelLogSink, traceEnricher } from '@cleverbrush/otel';
import knex from 'knex';
import { config } from './config.js';
import { runMigrations } from './db/migrate.js';
import { buildServer } from './server.js';
import { otel } from './telemetry.js';

async function main() {
    const logger = createLogger({
        minimumLevel: config.logLevel,
        sinks: [consoleSink({ theme: 'dark' }), otelLogSink()],
        enrichers: [hostnameEnricher(), processIdEnricher(), traceEnricher()],
        handleProcessExit: true
    });

    const migrationKnex = knex({
        client: 'pg',
        connection: config.db.connectionString,
        pool: { min: 1, max: 1 }
    });

    try {
        logger.info('Running database migrations', {});
        await runMigrations(migrationKnex);
        logger.info('Database migrations complete', {});
    } finally {
        await migrationKnex.destroy();
    }

    const server = buildServer(config, logger);
    const httpServer = await server.listen(config.api.port, config.api.host);
    logger.info('xpenser API listening on {Host}:{Port}', {
        Host: config.api.host,
        Port: config.api.port
    });

    const shutdown = async (signal: string) => {
        logger.info('Received shutdown signal {Signal}', { Signal: signal });
        try {
            await httpServer.close();
        } finally {
            await logger.dispose();
            await otel.shutdown();
            process.exit(0);
        }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(err => {
    console.error('[xpenser-api] fatal startup error:', err);
    process.exit(1);
});
