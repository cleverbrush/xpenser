import {
    createHash,
    randomBytes,
    randomUUID,
    timingSafeEqual
} from 'node:crypto';
import { query } from '@cleverbrush/knex-schema';
import {
    type JobRepository,
    type JobRun,
    JobScheduler
} from '@cleverbrush/scheduler';
import { PostgresJobRepository } from '@cleverbrush/scheduler-postgres';
import type {
    TransactionScanBody,
    TransactionScanJobResponse,
    TransactionScanProgressEvent,
    TransactionScanProgressQuery,
    TransactionScanResponse
} from '@xpenser/contracts';
import type { Config } from '../config.js';
import { ScanRequestDbSchema } from '../db/scan-request-schema.js';
import type { AppDb } from '../db/schemas.js';
import {
    jobNamespace,
    scanRetentionMs,
    TransactionScanJob
} from '../jobs/definitions.js';
import { scanReads } from '../jobs/scan-reads.js';
import { loadScanResult } from '../jobs/scan-results.js';
import { requireBudgetPermission, resolveBudgetAccess } from './budgets.js';
import { OpenAIConfigError } from './openai.js';
import { scanImageBuffer } from './transaction-scans.js';

const failureMessage = 'Could not scan the image. Try again.';
const tokenHash = (token: string) =>
    createHash('sha256').update(token).digest('hex');

/** Domain messages stay independent of the durable execution engine. */
export function scanProgressEvent(
    jobId: string,
    stage: TransactionScanProgressEvent['stage'],
    options: {
        scan?: TransactionScanResponse;
        error?: string;
        retry?: boolean;
    } = {}
): TransactionScanProgressEvent {
    const stages = {
        queued: [
            0,
            options.retry
                ? 'Scan interrupted. Retrying automatically.'
                : 'Scan queued.'
        ],
        preparing: [
            15,
            'Loading categories, vendors, and prior scan corrections.'
        ],
        analyzing: [45, 'Reading image details with AI.'],
        saving: [85, 'Saving scan suggestions for review.'],
        complete: [
            100,
            `Found ${options.scan?.drafts.length ?? 0} ${(options.scan?.drafts.length ?? 0) === 1 ? 'transaction' : 'transactions'} for review.`
        ],
        failed: [100, 'Scan failed.']
    } as const;
    return {
        jobId,
        stage,
        progress: stages[stage][0],
        message: stages[stage][1],
        scan: options.scan ?? null,
        error: options.error ?? null
    };
}

function notFound(jobId: string): TransactionScanProgressEvent {
    return {
        ...scanProgressEvent(jobId, 'failed', {
            error: 'Scan job was not found.'
        }),
        message: 'Scan job was not found.'
    };
}

/** Producer and authorized progress adapter. Constructing this service never starts workers. */
export class TransactionScanJobs {
    private readonly streams = new AbortController();
    constructor(
        private readonly db: AppDb,
        private readonly config: Config,
        readonly scheduler: JobScheduler,
        private readonly repository: JobRepository
    ) {}

    /** Persist acceptance and its artifact atomically, before sending HTTP 202. */
    async start(
        userId: number,
        body: TransactionScanBody
    ): Promise<TransactionScanJobResponse> {
        const access = await resolveBudgetAccess(
            this.db,
            userId,
            body.budgetId
        );
        requireBudgetPermission(access, 'canCreateTransactions');
        scanImageBuffer(body.imageBase64);
        if (!this.config.openai.apiKey)
            throw new OpenAIConfigError('OPENAI_API_KEY is not set.');
        const requestId = randomUUID();
        const token = randomBytes(32).toString('base64url');
        const jobId = await this.db.transaction(async transaction => {
            await transaction.scanRequests.insert({
                id: requestId,
                runId: null,
                userId,
                budgetId: access.budget.id,
                tokenHash: tokenHash(token),
                imageBase64: body.imageBase64,
                mimeType: body.mimeType,
                fileName: body.fileName ?? null,
                scanId: null
            });
            const producer = new JobScheduler({
                namespace: jobNamespace,
                storageRepository: new PostgresJobRepository(transaction.knex)
            });
            const run = await producer.enqueue(
                TransactionScanJob,
                { requestId },
                { idempotencyKey: `${userId}:${requestId}` }
            );
            await transaction.scanRequests
                .where(row => row.id, requestId)
                .update({ runId: run.id });
            return run.id;
        });
        return { jobId, token };
    }

    private async authorize(input: TransactionScanProgressQuery) {
        // Never load the image when polling or opening a progress stream.
        const [request] = await scanReads.request(this.db.knex, input.jobId);
        if (
            !request ||
            !timingSafeEqual(
                Buffer.from(request.tokenHash, 'hex'),
                Buffer.from(tokenHash(input.token), 'hex')
            )
        )
            return undefined;
        const run = await this.scheduler.getRun(
            TransactionScanJob,
            input.jobId
        );
        if (
            !run ||
            (run.completedAt !== null &&
                run.completedAt + scanRetentionMs <= Date.now())
        )
            return undefined;
        return { request, run };
    }

    private async snapshot(
        run: JobRun<{ scanId: number }>,
        budgetId: number
    ): Promise<TransactionScanProgressEvent> {
        switch (run.status) {
            case 'succeeded': {
                if (!run.output) return notFound(run.id);
                const scan = await loadScanResult(
                    this.db,
                    run.output.scanId,
                    budgetId
                );
                return scanProgressEvent(run.id, 'complete', { scan });
            }
            case 'failed':
            case 'cancelled':
                return scanProgressEvent(run.id, 'failed', {
                    error:
                        run.error?.code === 'SCAN_INPUT'
                            ? run.error.message
                            : failureMessage
                });
            case 'queued':
            case 'retry_wait':
                return scanProgressEvent(run.id, 'queued', {
                    retry: run.status === 'retry_wait'
                });
            default: {
                const [last] = await this.repository.events(
                    jobNamespace,
                    run.id,
                    Math.max(0, run.sequence - 1),
                    1
                );
                const stage =
                    last?.sequence === run.sequence && last.type === 'progress'
                        ? TransactionScanJob.progress.parse(last.data).stage
                        : 'preparing';
                return scanProgressEvent(run.id, stage);
            }
        }
    }

    /** Missing, expired and incorrect tokens intentionally have one indistinguishable result. */
    async status(
        input: TransactionScanProgressQuery
    ): Promise<TransactionScanProgressEvent> {
        const authorized = await this.authorize(input);
        return authorized
            ? this.snapshot(authorized.run, authorized.request.budgetId)
            : notFound(input.jobId);
    }

    /** Replay committed events; disconnecting only closes the observer, never the scan. */
    async *subscribe(
        input: TransactionScanProgressQuery,
        signal?: AbortSignal
    ): AsyncGenerator<TransactionScanProgressEvent> {
        const authorized = await this.authorize(input);
        if (!authorized) {
            yield notFound(input.jobId);
            return;
        }
        const combined = signal
            ? AbortSignal.any([signal, this.streams.signal])
            : this.streams.signal;
        for await (const event of this.scheduler.events(
            TransactionScanJob,
            input.jobId,
            { signal: combined }
        )) {
            switch (event.type) {
                case 'progress':
                    yield scanProgressEvent(input.jobId, event.data.stage);
                    break;
                case 'running':
                    yield scanProgressEvent(input.jobId, 'preparing');
                    break;
                case 'queued':
                case 'retry_wait':
                    yield scanProgressEvent(input.jobId, 'queued', {
                        retry: event.type === 'retry_wait'
                    });
                    break;
                case 'succeeded':
                case 'failed':
                case 'cancelled':
                    yield await this.status(input);
                    break;
            }
        }
    }

    /** Interrupt long-lived streams before waiting for the HTTP server to close. */
    closeStreams(): void {
        this.streams.abort();
    }

    /** Rotate a bounded page to avoid active requests starving old artifacts of cleanup. */
    async cleanup(signal: AbortSignal): Promise<void> {
        const requests = await query(this.db.knex, ScanRequestDbSchema)
            .select(row => ({ id: row.id, runId: row.runId }))
            .where(
                row => row.createdAt,
                '<',
                new Date(Date.now() - scanRetentionMs)
            )
            .orderBy(row => row.checkedAt)
            .limit(100);
        for (const request of requests) {
            signal.throwIfAborted();
            const run = request.runId
                ? await this.scheduler.getRun(TransactionScanJob, request.runId)
                : undefined;
            if (
                !run ||
                (run.completedAt !== null &&
                    run.completedAt + scanRetentionMs <= Date.now())
            ) {
                await this.db.scanRequests
                    .where(row => row.id, request.id)
                    .delete();
            } else {
                await this.db.scanRequests
                    .where(row => row.id, request.id)
                    .update({ checkedAt: new Date() });
            }
        }
    }
}
