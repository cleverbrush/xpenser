import {
    date,
    generateCreateTable,
    number,
    object,
    string
} from '@cleverbrush/knex-schema';
import {
    createSchedulerTables,
    dropSchedulerTables
} from '@cleverbrush/scheduler-postgres';
import type { Knex } from 'knex';

// Frozen migration schema: runtime entities may evolve independently of history.
const ScanRequestDbSchema = object({
    id: string().primaryKey(),
    runId: string().nullable().optional().hasColumnName('run_id').unique(),
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE'),
    budgetId: number()
        .hasColumnName('budget_id')
        .references('budgets', 'id')
        .onDelete('CASCADE'),
    tokenHash: string().hasColumnName('token_hash'),
    imageBase64: string()
        .columnType('text')
        .nullable()
        .optional()
        .hasColumnName('image_base64'),
    mimeType: string().hasColumnName('mime_type'),
    fileName: string().nullable().optional().hasColumnName('file_name'),
    scanId: number()
        .nullable()
        .optional()
        .hasColumnName('scan_id')
        .references('transaction_scans', 'id')
        .onDelete('CASCADE'),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    checkedAt: date()
        .hasColumnName('checked_at')
        .defaultTo('now')
        .index('scan_requests_cleanup')
}).hasTableName('transaction_scan_requests');

/** Scheduler storage and application artifacts share the existing database. */
export async function up(knex: Knex): Promise<void> {
    await createSchedulerTables(knex);
    await generateCreateTable(ScanRequestDbSchema)(knex);
}

/** Destructive rollback: stop producers and workers before invoking. */
export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable('transaction_scan_requests');
    await dropSchedulerTables(knex);
}
