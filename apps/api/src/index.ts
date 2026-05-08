import './telemetry.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { buildServer } from './server.js';
import {
  AppStarting,
  Listening,
  OpenApiSpec,
  ShutdownReceived,
  HttpServerClosed,
} from './logTemplates.js';
import type { Server as FrameworkServer } from '@cleverbrush/server';

let httpServer: FrameworkServer | null = null;

async function main() {
  const server = buildServer(config, logger);
  httpServer = await server.listen(config.server.apiPort, config.server.apiHost);
  logger.info(Listening, { Host: config.server.apiHost, Port: config.server.apiPort });
  logger.info(OpenApiSpec, { Host: config.server.apiHost, Port: config.server.apiPort });
}

const FORCED_SHUTDOWN_TIMEOUT = 30_000;

function shutdown(signal: string) {
  logger.info(ShutdownReceived, { Signal: signal });

  const forceExit = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, FORCED_SHUTDOWN_TIMEOUT);

  (async () => {
    try {
      if (httpServer) {
        await httpServer.close();
        logger.info(HttpServerClosed, {});
      }
      clearTimeout(forceExit);
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown: {Error}', { Error: String(err) });
      clearTimeout(forceExit);
      process.exit(1);
    }
  })();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  logger.error('Failed to start: {Error}', { Error: String(err) });
  process.exit(1);
});
