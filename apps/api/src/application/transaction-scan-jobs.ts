import { randomBytes, randomUUID } from 'node:crypto';
import type {
    TransactionScanBody,
    TransactionScanJobResponse,
    TransactionScanProgressEvent,
    TransactionScanProgressQuery,
    TransactionScanResponse
} from '@xpenser/contracts';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';
import {
    scanTransactionsFromImage,
    TransactionScanInputError
} from './transaction-scans.js';

const jobTtlMs = 30 * 60 * 1_000;

type MutableScanJob = {
    readonly events: TransactionScanProgressEvent[];
    readonly id: string;
    readonly listeners: Set<() => void>;
    readonly token: string;
    readonly userId: number;
    deleteTimer: ReturnType<typeof setTimeout> | null;
    done: boolean;
    expiresAt: number;
};

type ProgressStage = Exclude<
    TransactionScanProgressEvent['stage'],
    'complete' | 'failed' | 'queued'
>;

const jobs = new Map<string, MutableScanJob>();

function scheduleDelete(job: MutableScanJob): void {
    if (job.deleteTimer) {
        return;
    }

    job.deleteTimer = setTimeout(() => {
        if (jobs.get(job.id) === job) {
            jobs.delete(job.id);
        }
    }, jobTtlMs);
    job.deleteTimer.unref?.();
}

function cleanupExpiredJobs(): void {
    const now = Date.now();
    for (const [jobId, job] of jobs) {
        if (job.expiresAt <= now) {
            jobs.delete(jobId);
            if (job.deleteTimer) {
                clearTimeout(job.deleteTimer);
            }
        }
    }
}

function notify(job: MutableScanJob): void {
    for (const listener of job.listeners) {
        listener();
    }
    job.listeners.clear();
}

function event({
    error = null,
    job,
    message,
    progress,
    scan = null,
    stage
}: {
    readonly error?: string | null;
    readonly job: MutableScanJob;
    readonly message: string;
    readonly progress: number;
    readonly scan?: TransactionScanResponse | null;
    readonly stage: TransactionScanProgressEvent['stage'];
}): TransactionScanProgressEvent {
    return {
        jobId: job.id,
        stage,
        message,
        progress,
        scan,
        error
    };
}

function emit(job: MutableScanJob, nextEvent: TransactionScanProgressEvent) {
    if (job.done) {
        return;
    }

    job.events.push(nextEvent);
    if (nextEvent.stage === 'complete' || nextEvent.stage === 'failed') {
        job.done = true;
        job.expiresAt = Date.now() + jobTtlMs;
        scheduleDelete(job);
    }
    notify(job);
}

function progressMessage(stage: ProgressStage): string {
    switch (stage) {
        case 'preparing':
            return 'Loading categories, vendors, and prior scan corrections.';
        case 'analyzing':
            return 'Reading image details with AI.';
        case 'saving':
            return 'Saving scan suggestions for review.';
    }
    return 'Scanning image.';
}

function progressValue(stage: ProgressStage): number {
    switch (stage) {
        case 'preparing':
            return 15;
        case 'analyzing':
            return 45;
        case 'saving':
            return 85;
    }
    return 50;
}

function failureMessage(err: unknown): string {
    return err instanceof TransactionScanInputError
        ? err.message
        : 'Could not scan the image. Try again.';
}

async function runJob(
    job: MutableScanJob,
    db: AppDb,
    config: Config,
    body: TransactionScanBody
): Promise<void> {
    try {
        const scan = await scanTransactionsFromImage(
            db,
            config,
            job.userId,
            body,
            {
                onProgress: stage =>
                    emit(
                        job,
                        event({
                            job,
                            message: progressMessage(stage),
                            progress: progressValue(stage),
                            stage
                        })
                    )
            }
        );
        const count = scan.drafts.length;
        emit(
            job,
            event({
                job,
                message:
                    count === 1
                        ? 'Found 1 transaction for review.'
                        : `Found ${count} transactions for review.`,
                progress: 100,
                scan,
                stage: 'complete'
            })
        );
    } catch (err) {
        emit(
            job,
            event({
                error: failureMessage(err),
                job,
                message: 'Scan failed.',
                progress: 100,
                stage: 'failed'
            })
        );
    }
}

function createJob(userId: number): MutableScanJob {
    return {
        events: [],
        id: randomUUID(),
        listeners: new Set(),
        token: randomBytes(32).toString('base64url'),
        userId,
        deleteTimer: null,
        done: false,
        expiresAt: Date.now() + jobTtlMs
    };
}

export function startTransactionScanJob(
    db: AppDb,
    config: Config,
    userId: number,
    body: TransactionScanBody
): TransactionScanJobResponse {
    cleanupExpiredJobs();
    const job = createJob(userId);
    jobs.set(job.id, job);
    emit(
        job,
        event({
            job,
            message: 'Scan queued.',
            progress: 0,
            stage: 'queued'
        })
    );
    void runJob(job, db, config, body);
    return { jobId: job.id, token: job.token };
}

function authorizedJob(query: TransactionScanProgressQuery) {
    cleanupExpiredJobs();
    const job = jobs.get(query.jobId);
    return job && job.token === query.token ? job : undefined;
}

function waitForEvent(job: MutableScanJob, signal: AbortSignal): Promise<void> {
    if (signal.aborted || job.done) {
        return Promise.resolve();
    }

    return new Promise(resolve => {
        let resolved = false;
        const listener = () => {
            if (resolved) {
                return;
            }
            resolved = true;
            job.listeners.delete(listener);
            signal.removeEventListener('abort', abortListener);
            resolve();
        };
        const abortListener = () => listener();
        job.listeners.add(listener);
        signal.addEventListener('abort', abortListener, { once: true });
    });
}

export async function* subscribeTransactionScanJob(
    query: TransactionScanProgressQuery,
    signal: AbortSignal
): AsyncGenerator<TransactionScanProgressEvent> {
    const job = authorizedJob(query);
    if (!job) {
        yield {
            jobId: query.jobId,
            stage: 'failed',
            message: 'Scan job was not found.',
            progress: 100,
            scan: null,
            error: 'Scan job was not found.'
        };
        return;
    }

    let index = 0;
    while (!signal.aborted) {
        while (index < job.events.length) {
            const nextEvent = job.events[index];
            index += 1;
            if (nextEvent) {
                yield nextEvent;
            }
        }
        if (job.done) {
            return;
        }
        await waitForEvent(job, signal);
    }
}
