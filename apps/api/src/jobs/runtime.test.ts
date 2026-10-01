import { InMemoryJobRepository, JobScheduler } from '@cleverbrush/scheduler';
import { describe, expect, it, vi } from 'vitest';
import type { Config } from '../config.js';
import { EmailReportSweepJob, ScanCleanupJob } from './definitions.js';
import { emailScheduleId, registerJobSchedules } from './runtime.js';

const config = (enabled = true, schedulerEnabled = true) =>
    ({ emailReports: { enabled, schedulerEnabled } }) as Config;

describe('recurring application schedules', () => {
    it('registers hourly coalescing and preserves its anchor and revision on restart', async () => {
        const repository = new InMemoryJobRepository();
        const scheduler = new JobScheduler({ storageRepository: repository });
        const spy = vi.spyOn(scheduler, 'upsertSchedule');
        await registerJobSchedules(scheduler, config());
        const first = await repository.storage.atomic(tx =>
            tx.schedule('default', emailScheduleId)
        );
        await registerJobSchedules(
            new JobScheduler({ storageRepository: repository }),
            config()
        );
        const second = await repository.storage.atomic(tx =>
            tx.schedule('default', emailScheduleId)
        );
        expect(second).toEqual(first);
        expect(spy).toHaveBeenCalledWith(
            emailScheduleId,
            EmailReportSweepJob,
            {},
            {
                schedule: { every: 'minute', interval: 60 },
                missed: 'coalesce',
                overlap: 'skip'
            }
        );
        expect(first?.schedule.startsOn).toBeTypeOf('number');
        expect(EmailReportSweepJob.policy.retry.maxAttempts).toBe(1);
    });
    it.each([
        [false, true],
        [true, false]
    ])('removes disabled email triggers without disabling cleanup (%s, %s)', async (enabled, schedulerEnabled) => {
        const repository = new InMemoryJobRepository();
        const scheduler = new JobScheduler({ storageRepository: repository });
        await registerJobSchedules(scheduler, config());
        await registerJobSchedules(
            scheduler,
            config(enabled, schedulerEnabled)
        );
        const email = await repository.storage.atomic(tx =>
            tx.schedule('default', emailScheduleId)
        );
        const cleanup = await repository.storage.atomic(tx =>
            tx.schedule('default', 'scan-artifact-cleanup')
        );
        expect(email?.removed).toBe(true);
        expect(cleanup?.active).toBe(true);
        expect(cleanup?.name).toBe(ScanCleanupJob.name);
    });
});
