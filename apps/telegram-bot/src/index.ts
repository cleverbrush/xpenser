import type { Logger } from '@cleverbrush/log';
import type { XpenserTelegramBot } from './bot.js';
import { ShutdownSignalReceived } from './log-templates.js';
import { otel } from './telemetry.js';

let bot: XpenserTelegramBot | undefined;
let logger: Logger | undefined;
let shuttingDown = false;

function toError(err: unknown): Error {
    return err instanceof Error ? err : new Error(String(err));
}

async function createBootstrapLogger(): Promise<Logger> {
    const [
        { consoleSink, createLogger, hostnameEnricher, processIdEnricher },
        { otelLogSink, traceEnricher }
    ] = await Promise.all([
        import('@cleverbrush/log'),
        import('@cleverbrush/otel')
    ]);

    return createLogger({
        minimumLevel: 'information',
        sinks: [consoleSink({ theme: 'dark' }), otelLogSink()],
        enrichers: [hostnameEnricher(), processIdEnricher(), traceEnricher()],
        handleProcessExit: true
    });
}

async function main() {
    logger = await createBootstrapLogger();
    const [{ XpenserTelegramBot }, { botConfig }] = await Promise.all([
        import('./bot.js'),
        import('./config.js')
    ]);

    logger.setMinimumLevel(botConfig.logLevel);
    bot = new XpenserTelegramBot(botConfig, logger);
    bot.start();
    logger.info('xpenser Telegram bot started', {});
}

async function shutdown(signal: string, exitCode = 0) {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;
    logger?.info(ShutdownSignalReceived, { Signal: signal });
    try {
        await bot?.stop();
    } finally {
        await logger?.dispose();
        await otel.shutdown();
        process.exit(exitCode);
    }
}

process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
    void shutdown('SIGINT');
});

main().catch(async err => {
    const error = toError(err);
    if (logger) {
        logger.fatal(error, 'xpenser Telegram bot fatal startup error', {});
    } else {
        console.error('[telegram-bot] fatal startup error:', error);
    }
    await shutdown('startup-failure', 1);
});
