import type { ServiceCollection } from '@cleverbrush/di';
import type { Logger } from '@cleverbrush/log';
import { createDb } from '@cleverbrush/orm';
import { instrumentKnex } from '@cleverbrush/otel';
import knex, { type Knex } from 'knex';
import type { Config } from '../config.js';
import { type AppDb, entityMap } from '../db/schemas.js';
import { ConfigToken, DbToken, KnexToken, LoggerToken } from './tokens.js';

export type DbResources = {
    readonly knex: Knex;
    readonly db: AppDb;
};

/**
 * Creates the shared database resources used by Cleverbrush DI.
 *
 * The same instrumented Knex instance backs both direct SQL and
 * `@cleverbrush/orm` DbSets, so every query participates in request traces
 * without duplicating connection pools. SQL text is redacted at the telemetry
 * boundary to avoid leaking sensitive literals or tenant-specific identifiers.
 */
export function createDbResources(config: Config, logger: Logger): DbResources {
    const connection = instrumentKnex(
        knex({
            client: 'pg',
            connection: config.db.connectionString,
            pool: { min: 2, max: 10 },
            acquireConnectionTimeout: 10_000
        }),
        { sanitizeStatement: () => '<redacted>' }
    );
    logger.debug('Configured application database connection pool', {});
    return {
        knex: connection,
        db: createDb(connection, entityMap)
    };
}

/**
 * Registers request-handler dependencies for `endpoint.inject(...)`.
 *
 * The tokens are schema instances, matching the Cleverbrush DI convention of
 * using typed schemas as service keys rather than string names or decorators.
 */
export function configureDI(
    services: ServiceCollection,
    config: Config,
    logger: Logger,
    resources?: DbResources
): void {
    const dbResources = resources ?? createDbResources(config, logger);
    services.addSingleton(ConfigToken, config);
    services.addSingleton(LoggerToken, logger);
    services.addSingletonInstance(KnexToken, dbResources.knex);
    services.addSingletonInstance(DbToken, dbResources.db);
}
