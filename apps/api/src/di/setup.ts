import type { ServiceCollection } from '@cleverbrush/di';
import type { Logger } from '@cleverbrush/log';
import { createDb } from '@cleverbrush/orm';
import { instrumentKnex } from '@cleverbrush/otel';
import knex from 'knex';
import type { Config } from '../config.js';
import { entityMap } from '../db/schemas.js';
import { ConfigToken, DbToken, KnexToken, LoggerToken } from './tokens.js';

export function configureDI(
    services: ServiceCollection,
    config: Config,
    logger: Logger
): void {
    services.addSingleton(ConfigToken, config);
    services.addSingleton(LoggerToken, logger);
    services.addSingleton(KnexToken, () =>
        instrumentKnex(
            knex({
                client: 'pg',
                connection: config.db.connectionString,
                pool: { min: 2, max: 10 },
                acquireConnectionTimeout: 10_000
            })
        )
    );
    services.addSingleton(DbToken, provider =>
        createDb(provider.get(KnexToken), entityMap)
    );
}
