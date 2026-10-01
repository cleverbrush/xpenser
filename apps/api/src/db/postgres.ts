import knex, { type Knex } from 'knex';
import pg from 'pg';

/**
 * Create an application PostgreSQL connection with UTC Date parameter encoding.
 * Framework decodes SQL dates as UTC Dates. pg otherwise serializes parameters
 * in the process timezone, which can change the calendar day of a DATE column.
 * This driver option is process-wide; all application pools use the same policy.
 * Timestamp-with-timezone values retain their original instant.
 */
export function createPostgresConnection(
    config: Omit<Knex.Config, 'client'>
): Knex {
    pg.defaults.parseInputDatesAsUTC = true;
    return knex({ ...config, client: 'pg' });
}
