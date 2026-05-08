import type { BoundQuery, DbContext, TrackedDbContext } from '@cleverbrush/orm';
import type { Logger } from '@cleverbrush/log';
import { any } from '@cleverbrush/schema';
import type { Knex } from 'knex';
import type { Config } from '../config.js';
import type { AppEntityMap } from '../db/schemas.js';

export const KnexToken = any().hasType<Knex>();

export const BoundQueryToken = any().hasType<BoundQuery>();

export const DbToken = any().hasType<DbContext<AppEntityMap>>();

export const TrackedDbToken = any().hasType<TrackedDbContext<AppEntityMap>>();

export const ConfigToken = any().hasType<Config>();

export const LoggerToken = any().hasType<Logger>();
