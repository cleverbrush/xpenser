import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import type { Logger } from '@cleverbrush/log';
import { createDb } from '@cleverbrush/orm';
import { JobScheduler, LeaseLostError } from '@cleverbrush/scheduler';
import { PostgresJobRepository } from '@cleverbrush/scheduler-postgres';
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';
import * as email from '../src/application/email.js';
import { sendDueEmailReports } from '../src/application/email-reports.js';
import * as openai from '../src/application/openai.js';
import { TransactionScanJobs } from '../src/application/transaction-scan-jobs.js';
import type { Config } from '../src/config.js';
import { createPostgresConnection } from '../src/db/postgres.js';
import { entityMap } from '../src/db/schemas.js';
import {
    EmailReportSweepJob,
    jobNamespace,
    scanRetentionMs,
    TransactionScanJob
} from '../src/jobs/definitions.js';
import { emailScheduleId, registerJobSchedules } from '../src/jobs/runtime.js';
import { createScanHandler } from '../src/jobs/scan-handler.js';

const connection = process.env.QUERY_TEST_DATABASE_URL;
if (!connection || new URL(connection).pathname !== '/xpenser_queries')
    throw new Error(
        'QUERY_TEST_DATABASE_URL must point to a dedicated xpenser_queries database'
    );
const schema = 'xpenser_jobs_' + randomUUID().replaceAll('-', '');
const knex = createPostgresConnection({
    connection,
    searchPath: [schema],
    pool: { min: 0, max: 8 }
});
const db = createDb(knex, entityMap);
const config = {
    openai: { apiKey: 'test-only', transactionScanModel: 'test-model' },
    emailReports: { enabled: true, schedulerEnabled: true }
} as Config;
const repository = new PostgresJobRepository(knex);
const scheduler = new JobScheduler({
    storageRepository: repository,
    namespace: jobNamespace,
    pollIntervalMs: 5
});
const scans = new TransactionScanJobs(db, config, scheduler, repository);
const body = {
    budgetId: 1,
    imageBase64: 'aW1hZ2U=',
    mimeType: 'image/png' as const
};
const aiResult = {
    documentKind: 'receipt',
    warnings: [],
    transactions: [
        {
            amount: 12.34,
            currency: 'USD',
            occurredDate: '2026-10-01',
            note: 'Lunch',
            transactionType: 'expense'
        }
    ]
};
let created = false;

beforeAll(async () => {
    await knex.schema.createSchema(schema);
    created = true;
    const directory = new URL('../src/db/migrations/', import.meta.url);
    for (const file of readdirSync(directory)
        .filter(f => f.endsWith('.ts'))
        .sort()) {
        await (await import(new URL(file, directory).href)).up(knex);
    }
    await knex('users').insert([
        { id: 1, email: 'scan@example.test' },
        { id: 2, email: 'outsider@example.test' }
    ]);
    await knex('budgets').insert({
        id: 1,
        name: 'Scan test',
        created_by_user_id: 1,
        default_currency: 'USD'
    });
    await knex('users').where('id', 1).update({ main_budget_id: 1 });
    await knex('budget_members').insert({
        budget_id: 1,
        user_id: 1,
        display_name: 'Scan test',
        role: 'admin'
    });
});
beforeEach(async () => {
    await knex('transaction_scan_requests').delete();
    await knex('transaction_scans').delete();
    await knex('transactions').delete();
    await knex('categories').delete();
    await knex('email_report_deliveries').delete();
    // This entire schema is disposable, including all library-owned test records.
    await knex('cb_jobs_runs').delete();
    await knex('cb_jobs_schedules').delete();
    vi.spyOn(openai, 'generateStructuredJsonFromContent').mockResolvedValue(
        aiResult
    );
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
    if (created) await knex.schema.dropSchema(schema, true);
    await knex.destroy();
});

async function accelerate(id: string, retentionMs = scanRetentionMs) {
    // Public adapter test boundary: keep the production contract but shorten test clocks.
    await repository.storage.atomic(async tx => {
        const run = await tx.run(jobNamespace, id, true);
        if (!run) throw new Error('Missing test run');
        run.policy.retry.initialDelayMs = 5;
        run.policy.retry.maxDelayMs = 10;
        run.policy.retentionMs = retentionMs;
        await tx.saveRun(run);
    });
}
async function claim(leaseMs = 10_000) {
    const run = await repository.claim(
        jobNamespace,
        [TransactionScanJob],
        leaseMs
    );
    if (!run?.leaseToken) throw new Error('No scan claimed');
    return run;
}
async function execute(
    run: Awaited<ReturnType<typeof claim>>,
    signal = new AbortController().signal
) {
    return createScanHandler(db, config)(
        TransactionScanJob.input.parse(run.input),
        {
            runId: run.id,
            attempt: run.attempt,
            signal,
            report: progress =>
                repository.report(
                    jobNamespace,
                    run.id,
                    run.leaseToken!,
                    progress
                )
        }
    );
}
async function waitTerminal(id: string) {
    await vi.waitFor(
        async () => {
            expect(
                (await scheduler.getRun(TransactionScanJob, id))?.status
            ).toMatch(/^(succeeded|failed)$/);
        },
        { timeout: 10_000, interval: 15 }
    );
    return (await scheduler.getRun(TransactionScanJob, id))!;
}

describe('durable scan application integration', () => {
    it('rechecks budget permissions before execution without retrying permanent denial', async () => {
        const job = await scans.start(1, body);
        await knex('budget_members')
            .where({ budget_id: 1, user_id: 1 })
            .update({ role: 'member', can_create_transactions: false });
        const worker = scheduler.createWorker({
            jobs: [TransactionScanJob.handle(createScanHandler(db, config))],
            pollIntervalMs: 5
        });
        await worker.start();
        try {
            expect(await waitTerminal(job.jobId)).toMatchObject({
                status: 'failed',
                attempt: 1
            });
            expect(
                openai.generateStructuredJsonFromContent
            ).not.toHaveBeenCalled();
        } finally {
            await worker.stop({ drainTimeoutMs: 100 });
            await knex('budget_members')
                .where({ budget_id: 1, user_id: 1 })
                .update({ role: 'admin', can_create_transactions: true });
        }
    });
    it('persists compact acceptance, hashes capability tokens and gates readers on any replica', async () => {
        const large = {
            ...body,
            imageBase64: Buffer.alloc(1100 * 1024, 42).toString('base64')
        };
        const job = await scans.start(1, large);
        const request = await db.scanRequests
            .where(r => r.runId, job.jobId)
            .first();
        expect(request?.imageBase64).toBe(large.imageBase64);
        expect(request?.tokenHash).not.toBe(job.token);
        const run = await scheduler.getRun(TransactionScanJob, job.jobId);
        expect(run?.input).toEqual({ requestId: request?.id });
        const other = new TransactionScanJobs(
            db,
            config,
            new JobScheduler({
                namespace: jobNamespace,
                storageRepository: new PostgresJobRepository(knex)
            }),
            new PostgresJobRepository(knex)
        );
        expect(await other.status(job)).toMatchObject({ stage: 'queued' });
        expect(await other.status({ ...job, token: 'wrong' })).toMatchObject({
            error: 'Scan job was not found.'
        });
        expect(
            await other.status({ jobId: 'missing', token: job.token })
        ).toMatchObject({ error: 'Scan job was not found.' });
        await expect(scans.start(2, body)).rejects.toThrow();
        await expect(
            scans.start(1, { ...body, imageBase64: '' })
        ).rejects.toThrow('non-empty');
        expect((await db.scanRequests.count().first())?.count).toBe(1);
    });

    it('rolls back the artifact if durable enqueue fails', async () => {
        const spy = vi
            .spyOn(PostgresJobRepository.prototype, 'enqueue')
            .mockRejectedValue(new Error('storage unavailable'));
        await expect(scans.start(1, body)).rejects.toThrow(
            'storage unavailable'
        );
        spy.mockRestore();
        expect((await db.scanRequests.count().first())?.count).toBe(0);
        expect((await scheduler.health()).counts.queued ?? 0).toBe(0);
    });

    it('replays progress and reconstructs date-bearing results without retaining the image', async () => {
        const job = await scans.start(1, body);
        const run = await claim();
        const output = await execute(run);
        await repository.complete(
            jobNamespace,
            run.id,
            run.leaseToken!,
            output
        );
        const status = await scans.status(job);
        expect(status).toMatchObject({
            stage: 'complete',
            scan: { scanId: output.scanId }
        });
        expect(status.scan?.drafts[0]?.occurredAt).toBeInstanceOf(Date);
        expect(
            (await db.scanRequests.where(r => r.runId, job.jobId).first())
                ?.imageBase64
        ).toBeNull();
        const events = [];
        for await (const event of scans.subscribe(job))
            events.push(event.stage);
        expect(events).toEqual([
            'queued',
            'preparing',
            'preparing',
            'analyzing',
            'saving',
            'complete'
        ]);
    });

    it('serializes concurrent duplicate executions into a single scan and draft set', async () => {
        const job = await scans.start(1, body);
        const run = await claim();
        const outputs = await Promise.all([execute(run), execute(run)]);
        expect(outputs[0]).toEqual(outputs[1]);
        expect((await db.transactionScans.count().first())?.count).toBe(1);
        expect((await db.transactionScanItems.count().first())?.count).toBe(1);
        const again = await execute(run);
        expect(again).toEqual(outputs[0]);
        expect(openai.generateStructuredJsonFromContent).toHaveBeenCalledTimes(
            2
        );
        expect((await scans.status(job)).stage).not.toBe('failed');
    });

    it('rolls back headers and earlier items when a draft insert fails', async () => {
        vi.mocked(openai.generateStructuredJsonFromContent).mockResolvedValue({
            ...aiResult,
            transactions: [
                ...aiResult.transactions,
                { ...aiResult.transactions[0], note: 'rollback-marker' }
            ]
        });
        await knex.raw(
            "alter table transaction_scan_items add constraint reject_test_draft check (draft_json not like '%rollback-marker%')"
        );
        try {
            const job = await scans.start(1, body);
            await expect(execute(await claim())).rejects.toThrow(
                'Could not scan'
            );
            expect((await db.transactionScans.count().first())?.count).toBe(0);
            expect((await db.transactionScanItems.count().first())?.count).toBe(
                0
            );
            expect(
                (await db.scanRequests.where(r => r.runId, job.jobId).first())
                    ?.scanId
            ).toBeNull();
        } finally {
            await knex.raw(
                'alter table transaction_scan_items drop constraint reject_test_draft'
            );
        }
    });

    it('recovers after a committed result and expired owner without repeating AI or result writes', async () => {
        const job = await scans.start(1, body);
        await accelerate(job.jobId);
        const old = await claim(500);
        const output = await execute(old);
        await new Promise(resolve => setTimeout(resolve, 550));
        const worker = scheduler.createWorker({
            jobs: [TransactionScanJob.handle(createScanHandler(db, config))],
            pollIntervalMs: 10
        });
        await worker.start();
        try {
            const run = await waitTerminal(job.jobId);
            expect(run).toMatchObject({
                status: 'succeeded',
                attempt: 2,
                output
            });
            expect(
                openai.generateStructuredJsonFromContent
            ).toHaveBeenCalledTimes(1);
            expect((await db.transactionScans.count().first())?.count).toBe(1);
            await expect(
                repository.complete(
                    jobNamespace,
                    old.id,
                    old.leaseToken!,
                    output
                )
            ).rejects.toBeInstanceOf(LeaseLostError);
        } finally {
            await worker.stop({ drainTimeoutMs: 100 });
        }
    });

    it('competing workers recover a transient failure without duplicate drafts', async () => {
        vi.mocked(openai.generateStructuredJsonFromContent)
            .mockRejectedValueOnce(new Error('secret provider detail'))
            .mockResolvedValue(aiResult);
        const job = await scans.start(1, body);
        await accelerate(job.jobId);
        const workers = [
            scheduler,
            new JobScheduler({
                namespace: jobNamespace,
                storageRepository: new PostgresJobRepository(knex)
            })
        ].map(s =>
            s.createWorker({
                jobs: [
                    TransactionScanJob.handle(createScanHandler(db, config))
                ],
                pollIntervalMs: 10
            })
        );
        await Promise.all(workers.map(w => w.start()));
        try {
            const run = await waitTerminal(job.jobId);
            expect(run).toMatchObject({ status: 'succeeded', attempt: 2 });
            expect((await db.transactionScans.count().first())?.count).toBe(1);
            expect(
                JSON.stringify(
                    await repository.events(jobNamespace, job.jobId, 0)
                )
            ).not.toContain('secret provider');
        } finally {
            await Promise.all(
                workers.map(w => w.stop({ drainTimeoutMs: 100 }))
            );
        }
    });

    it('exhausts three attempts and leaves a sanitized terminal failure', async () => {
        vi.mocked(openai.generateStructuredJsonFromContent).mockRejectedValue(
            new Error('private provider body')
        );
        const job = await scans.start(1, body);
        await accelerate(job.jobId);
        const worker = scheduler.createWorker({
            jobs: [TransactionScanJob.handle(createScanHandler(db, config))],
            pollIntervalMs: 10
        });
        await worker.start();
        try {
            expect(await waitTerminal(job.jobId)).toMatchObject({
                status: 'failed',
                attempt: 3
            });
            expect(await scans.status(job)).toMatchObject({
                stage: 'failed',
                error: 'Could not scan the image. Try again.'
            });
            expect((await db.transactionScans.count().first())?.count).toBe(0);
        } finally {
            await worker.stop({ drainTimeoutMs: 100 });
        }
    });

    it('does not write results from an aborted attempt or cancel a job on subscriber disconnect', async () => {
        const job = await scans.start(1, body);
        const controller = new AbortController();
        const stream = scans.subscribe(job, controller.signal);
        expect((await stream.next()).value).toMatchObject({ stage: 'queued' });
        controller.abort();
        await stream.return(undefined);
        const run = await claim();
        await expect(execute(run, controller.signal)).rejects.toThrow();
        expect(
            (await scheduler.getRun(TransactionScanJob, job.jobId))?.status
        ).toBe('running');
        expect((await db.transactionScans.count().first())?.count).toBe(0);
    });

    it('cleans expired artifacts and events without deleting scan results or active requests', async () => {
        const old = await scans.start(1, body);
        await accelerate(old.jobId, 1);
        const run = await claim();
        const output = await execute(run);
        await repository.complete(
            jobNamespace,
            run.id,
            run.leaseToken!,
            output
        );
        const active = await scans.start(1, body);
        await db.scanRequests.update({
            createdAt: new Date(Date.now() - scanRetentionMs - 1000)
        });
        await new Promise(resolve => setTimeout(resolve, 10));
        await scheduler.cleanup();
        await scans.cleanup(new AbortController().signal);
        expect(await scans.status(old)).toMatchObject({
            error: 'Scan job was not found.'
        });
        expect(await scans.status(active)).toMatchObject({ stage: 'queued' });
        expect((await db.scanRequests.count().first())?.count).toBe(1);
        expect((await db.transactionScans.count().first())?.count).toBe(1);
        expect(await repository.events(jobNamespace, old.jobId, 0)).toEqual([]);
    });

    it('shutdown aborts an in-flight AI call and leaves the accepted job recoverable', async () => {
        vi.mocked(
            openai.generateStructuredJsonFromContent
        ).mockImplementationOnce(async (_config, options) => {
            await new Promise((_resolve, reject) =>
                options.signal!.addEventListener(
                    'abort',
                    () => reject(options.signal!.reason),
                    { once: true }
                )
            );
            return aiResult;
        });
        const job = await scans.start(1, body);
        await accelerate(job.jobId);
        const worker = scheduler.createWorker({
            jobs: [TransactionScanJob.handle(createScanHandler(db, config))],
            pollIntervalMs: 5
        });
        await worker.start();
        await vi.waitFor(() =>
            expect(openai.generateStructuredJsonFromContent).toHaveBeenCalled()
        );
        await worker.stop({ drainTimeoutMs: 20 });
        expect(
            (await scheduler.getRun(TransactionScanJob, job.jobId))?.status
        ).toBe('retry_wait');
        const resumed = scheduler.createWorker({
            jobs: [TransactionScanJob.handle(createScanHandler(db, config))],
            pollIntervalMs: 5
        });
        await resumed.start();
        try {
            expect(await waitTerminal(job.jobId)).toMatchObject({
                status: 'succeeded',
                attempt: 2
            });
        } finally {
            await resumed.stop({ drainTimeoutMs: 100 });
        }
    });

    it('multiple dispatchers preserve schedule identity and never duplicate overlapping sweeps', async () => {
        await registerJobSchedules(scheduler, config);
        const before = await repository.storage.atomic(tx =>
            tx.schedule(jobNamespace, emailScheduleId)
        );
        const restarted = new JobScheduler({
            namespace: jobNamespace,
            storageRepository: new PostgresJobRepository(knex)
        });
        await registerJobSchedules(restarted, config);
        expect(
            await repository.storage.atomic(tx =>
                tx.schedule(jobNamespace, emailScheduleId)
            )
        ).toEqual(before);
        await Promise.all([scheduler.dispatch(), restarted.dispatch()]);
        const sweep = await repository.claim(
            jobNamespace,
            [EmailReportSweepJob],
            1000
        );
        expect(sweep?.scheduleId).toBe(emailScheduleId);
        expect(
            await repository.claim(jobNamespace, [EmailReportSweepJob], 1000)
        ).toBeUndefined();
        await registerJobSchedules(restarted, {
            ...config,
            emailReports: { ...config.emailReports, schedulerEnabled: false }
        });
        expect(
            (
                await repository.storage.atomic(tx =>
                    tx.schedule(jobNamespace, emailScheduleId)
                )
            )?.removed
        ).toBe(true);
    });
});

describe('email sweep delivery ownership', () => {
    const now = new Date('2026-09-28T09:00:00Z');
    const reportConfig = {
        ...config,
        app: { url: 'https://example.test' },
        resend: { apiKey: 'test-only', emailFrom: 'test@example.test' },
        emailReports: {
            enabled: true,
            schedulerEnabled: true,
            maxAttempts: 3,
            deliveryHourLocal: 8
        }
    } as Config;
    const logger = {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    } as unknown as Logger;
    async function prepareReport() {
        const [category] = await knex('categories')
            .insert({
                budget_id: 1,
                user_id: 1,
                name: 'Lunch',
                type: 'expense'
            })
            .returning('id');
        await knex('transactions').insert({
            budget_id: 1,
            user_id: 1,
            category_id: category.id,
            type: 'expense',
            amount: '12.34',
            currency: 'USD',
            default_currency_amount: '12.34',
            default_currency: 'USD',
            exchange_rate: '1',
            exchange_rate_date: '2026-09-23',
            occurred_at: '2026-09-23T12:00:00Z'
        });
        vi.spyOn(openai, 'generateStructuredJson').mockResolvedValue({
            headline: 'Test',
            recap: 'Test recap',
            insights: [],
            actions: []
        });
        return vi
            .spyOn(email, 'sendEmail')
            .mockResolvedValue('test-provider-message');
    }
    it('retains delivery-ledger protection across concurrent and repeated sweeps', async () => {
        const provider = await prepareReport();
        await Promise.all(
            [1, 2].map(() =>
                sendDueEmailReports(db, knex, reportConfig, logger, now)
            )
        );
        await sendDueEmailReports(db, knex, reportConfig, logger, now);
        expect(logger.error).not.toHaveBeenCalled();
        expect(provider).toHaveBeenCalledTimes(1);
        expect(await db.emailReportDeliveries.first()).toMatchObject({
            status: 'sent',
            attempts: 1
        });
    });
    it('keeps an interrupted provider delivery pending instead of automatically resending', async () => {
        const provider = await prepareReport();
        const controller = new AbortController();
        provider.mockImplementationOnce(async (_config, options) => {
            expect(options.signal).toBe(controller.signal);
            controller.abort();
            throw controller.signal.reason;
        });
        await expect(
            sendDueEmailReports(
                db,
                knex,
                reportConfig,
                logger,
                now,
                controller.signal
            )
        ).rejects.toThrow();
        expect(await db.emailReportDeliveries.first()).toMatchObject({
            status: 'pending'
        });
        await sendDueEmailReports(db, knex, reportConfig, logger, now);
        expect(provider).toHaveBeenCalledTimes(1);
    });
});
