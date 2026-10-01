import type { Logger } from '@cleverbrush/log';
import { JobScheduler, type SchedulerDiagnostic } from '@cleverbrush/scheduler';
import { PostgresJobRepository } from '@cleverbrush/scheduler-postgres';
import { TransactionScanJobs } from '../application/transaction-scan-jobs.js';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';
import {
    EmailReportSweepJob,
    jobNamespace,
    ScanCleanupJob,
    TransactionScanJob
} from './definitions.js';
import { createEmailSweepHandler } from './email-handler.js';
import { createScanHandler } from './scan-handler.js';

export const emailScheduleId = 'email-reports-hourly';

/** Register stable recurring triggers without resetting their persisted anchor or cursor. */
export async function registerJobSchedules(
    scheduler: JobScheduler,
    config: Config
): Promise<void> {
    await scheduler.upsertSchedule(
        'scan-artifact-cleanup',
        ScanCleanupJob,
        {},
        {
            schedule: { every: 'minute', interval: 1 },
            missed: 'coalesce',
            overlap: 'skip'
        }
    );
    if (config.emailReports.enabled && config.emailReports.schedulerEnabled) {
        await scheduler.upsertSchedule(
            emailScheduleId,
            EmailReportSweepJob,
            {},
            {
                schedule: { every: 'minute', interval: 60 },
                missed: 'coalesce',
                overlap: 'skip'
            }
        );
    } else {
        await scheduler.removeSchedule(emailScheduleId);
    }
}

/** One lifecycle owner per API process. Construction is safe in producer-only tests. */
export function createJobRuntime(db: AppDb, config: Config, logger: Logger) {
    const repository = new PostgresJobRepository(db.knex);
    const scheduler = new JobScheduler({
        namespace: jobNamespace,
        storageRepository: repository,
        onError: () => logger.error('Background job dispatcher failed', {})
    });
    const scans = new TransactionScanJobs(db, config, scheduler, repository);
    const diagnostic = (event: SchedulerDiagnostic) => {
        const fields = {
            Type: event.type,
            Job: event.name ?? '',
            RunId: event.runId ?? '',
            Attempt: event.attempt ?? 0
        };
        if (
            event.type === 'infrastructure_error' ||
            event.type === 'lease_lost'
        )
            logger.warn('Background job diagnostic', fields);
        else logger.debug('Background job diagnostic', fields);
    };
    const scanWorker = scheduler.createWorker({
        jobs: [TransactionScanJob.handle(createScanHandler(db, config))],
        concurrency: 2,
        onDiagnostic: diagnostic
    });
    const maintenanceWorker = scheduler.createWorker({
        jobs: [
            EmailReportSweepJob.handle(
                createEmailSweepHandler(db, config, logger)
            ),
            ScanCleanupJob.handle(async (_input, context) => {
                try {
                    await scans.cleanup(context.signal);
                    return {};
                } catch {
                    throw new Error('Scan artifact cleanup could not finish.');
                }
            })
        ],
        concurrency: 1,
        onDiagnostic: diagnostic
    });
    return {
        scans,
        scheduler,
        async start() {
            await registerJobSchedules(scheduler, config);
            await scanWorker.start();
            await maintenanceWorker.start();
            await scheduler.start();
        },
        async stop(drainTimeoutMs = 30_000) {
            scans.closeStreams();
            await scheduler.stop();
            await Promise.all([
                scanWorker.stop({ drainTimeoutMs }),
                maintenanceWorker.stop({ drainTimeoutMs })
            ]);
        }
    };
}

export type JobRuntime = ReturnType<typeof createJobRuntime>;
