import type { Logger } from '@cleverbrush/log';
import { any } from '@cleverbrush/schema';
import type { Knex } from 'knex';
import type { Config } from '../config.js';

/** DI token for the parsed API configuration. */
export const ConfigToken = any().hasType<Config>();

/** DI token for the structured Cleverbrush logger. */
export const LoggerToken = any().hasType<Logger>();

/** DI token for the instrumented Knex connection pool. */
export const KnexToken = any().hasType<Knex>();
