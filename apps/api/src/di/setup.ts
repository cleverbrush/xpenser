import type { IServiceProvider, ServiceCollection } from '@cleverbrush/di';
import { createQuery, createDb } from '@cleverbrush/orm';
import type { Logger } from '@cleverbrush/log';
import { instrumentKnex } from '@cleverbrush/otel';
import knex from 'knex';
import type { Config } from '../config.js';
import { entityMap } from '../db/schemas.js';
import {
  BoundQueryToken,
  ConfigToken,
  DbToken,
  KnexToken,
  LoggerToken,
  TrackedDbToken,
} from './tokens.js';

export function configureDI(
  services: ServiceCollection,
  config: Config,
  logger: Logger,
): void {
  services.addSingleton(ConfigToken, config);
  services.addSingleton(LoggerToken, logger);

  services.addSingleton(KnexToken, () =>
    instrumentKnex(
      knex({
        client: 'pg',
        connection: config.db.connectionString,
        pool: { min: 2, max: 10 },
        acquireConnectionTimeout: 10_000,
      }),
    ),
  );

  services.addSingleton(BoundQueryToken, (provider: IServiceProvider) => {
    const knexInstance = provider.get(KnexToken) as Knex;
    return createQuery(knexInstance);
  });

  services.addSingleton(DbToken, (provider: IServiceProvider) => {
    const knexInstance = provider.get(KnexToken) as Knex;
    return createDb(knexInstance, entityMap);
  });

  services.addTransient(TrackedDbToken, (provider: IServiceProvider) => {
    const knexInstance = provider.get(KnexToken) as Knex;
    return createDb(knexInstance, entityMap, { tracking: true });
  });
}
