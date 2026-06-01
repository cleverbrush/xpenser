import {
    consoleSink,
    createLogger,
    hostnameEnricher,
    processIdEnricher
} from '@cleverbrush/log';
import { otelLogSink, traceEnricher } from '@cleverbrush/otel';
import knex from 'knex';
import { startEmailReportScheduler } from './application/email-report-scheduler.js';
import { config } from './config.js';
import { runMigrations } from './db/migrate.js';
import { createDbResources } from './di/setup.js';
import { ApiListening, ShutdownSignalReceived } from './log-templates.js';
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

    const dbResources = createDbResources(config, logger);
    const emailReportScheduler = startEmailReportScheduler({
        config,
        db: dbResources.db,
        knex: dbResources.knex,
        logger
    });
    const server = buildServer(config, logger, dbResources);
    const httpServer = await server.listen(config.api.port, config.api.host);
    logger.info(ApiListening, {
        Host: config.api.host,
        Port: config.api.port
    });

    const shutdown = async (signal: string) => {
        logger.info(ShutdownSignalReceived, { Signal: signal });
        try {
            await httpServer.close();
        } finally {
            emailReportScheduler.stop();
            await dbResources.knex.destroy();
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
