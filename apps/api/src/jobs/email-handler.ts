import type { Logger } from '@cleverbrush/log';
import { withSpan } from '@cleverbrush/otel';
import type { JobHandler } from '@cleverbrush/scheduler';
import { sendDueEmailReports } from '../application/email-reports.js';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';
import { EmailReportSweepJob } from './definitions.js';

/** The existing ledger, not scheduler retries, decides whether a report can be sent. */
export function createEmailSweepHandler(
    db: AppDb,
    config: Config,
    logger: Logger
): JobHandler<typeof EmailReportSweepJob> {
    return (_input, context) =>
        withSpan(
            'job.email-report-sweep',
            async () => {
                try {
                    context.signal.throwIfAborted();
                    await sendDueEmailReports(
                        db,
                        db.knex,
                        config,
                        logger,
                        new Date(),
                        context.signal
                    );
                    return {};
                } catch {
                    throw new Error('Email report sweep could not finish.');
                }
            },
            {
                attributes: {
                    'job.name': EmailReportSweepJob.name,
                    'job.run_id': context.runId,
                    'job.attempt': context.attempt
                }
            }
        );
}
