import { randomBytes, randomUUID } from 'node:crypto';
import type { Logger } from '@cleverbrush/log';
import type {
    CashFlowForecastJobBody,
    CashFlowForecastJobResponse,
    CashFlowForecastProgressEvent,
    CashFlowForecastProgressQuery,
    CashFlowForecastResponse
} from '@xpenser/contracts';
import type { Knex } from 'knex';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';
import { generateAndPersistCashFlowForecast } from './cash-flow-forecast.js';

const jobTtlMs = 30 * 60 * 1_000;

type MutableForecastJob = {
    readonly events: CashFlowForecastProgressEvent[];
    readonly id: string;
    readonly listeners: Set<() => void>;
    readonly token: string;
    readonly userId: number;
    deleteTimer: ReturnType<typeof setTimeout> | null;
    done: boolean;
    expiresAt: number;
};

type ProgressStage = Exclude<
    CashFlowForecastProgressEvent['stage'],
    'complete' | 'failed' | 'queued'
>;

const jobs = new Map<string, MutableForecastJob>();

function scheduleDelete(job: MutableForecastJob): void {
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

function notify(job: MutableForecastJob): void {
    for (const listener of job.listeners) {
        listener();
    }
    job.listeners.clear();
}

function event({
    error = null,
    forecast = null,
    job,
    message,
    progress,
    stage
}: {
    readonly error?: string | null;
    readonly forecast?: CashFlowForecastResponse | null;
    readonly job: MutableForecastJob;
    readonly message: string;
    readonly progress: number;
    readonly stage: CashFlowForecastProgressEvent['stage'];
}): CashFlowForecastProgressEvent {
    return {
        jobId: job.id,
        stage,
        message,
        progress,
        forecast,
        error
    };
}

function emit(
    job: MutableForecastJob,
    nextEvent: CashFlowForecastProgressEvent
): void {
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
            return 'Loading transaction history and recurring patterns.';
        case 'analyzing':
            return 'Generating AI forecast insight.';
        case 'saving':
            return 'Saving daily forecast.';
    }
    return 'Generating forecast.';
}

function progressValue(stage: ProgressStage): number {
    switch (stage) {
        case 'preparing':
            return 20;
        case 'analyzing':
            return 55;
        case 'saving':
            return 90;
    }
    return 50;
}

async function runJob(
    job: MutableForecastJob,
    db: AppDb,
    knex: Knex,
    config: Config,
    logger: Pick<Logger, 'warn'>,
    body: CashFlowForecastJobBody
): Promise<void> {
    try {
        const result = await generateAndPersistCashFlowForecast(
            db,
            knex,
            config,
            logger,
            job.userId,
            body,
            {
                force: body.force ?? false,
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
        if (result.status === 'failed') {
            emit(
                job,
                event({
                    error:
                        result.errorMessage ??
                        'Forecast generation failed. Try again.',
                    forecast: result.forecast,
                    job,
                    message: 'Forecast generation failed.',
                    progress: 100,
                    stage: 'failed'
                })
            );
            return;
        }

        emit(
            job,
            event({
                forecast: result.forecast,
                job,
                message: 'Forecast ready.',
                progress: 100,
                stage: 'complete'
            })
        );
    } catch (err) {
        emit(
            job,
            event({
                error: 'Forecast generation failed. Try again.',
                job,
                message: 'Forecast generation failed.',
                progress: 100,
                stage: 'failed'
            })
        );
        logger.warn('Cash-flow forecast job failed', {
            Error: err instanceof Error ? err.message : String(err),
            JobId: job.id,
            UserId: job.userId
        });
    }
}

function createJob(userId: number): MutableForecastJob {
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

export function startCashFlowForecastJob(
    db: AppDb,
    knex: Knex,
    config: Config,
    logger: Pick<Logger, 'warn'>,
    userId: number,
    body: CashFlowForecastJobBody
): CashFlowForecastJobResponse {
    cleanupExpiredJobs();
    const job = createJob(userId);
    jobs.set(job.id, job);
    emit(
        job,
        event({
            job,
            message: 'Forecast generation queued.',
            progress: 0,
            stage: 'queued'
        })
    );
    void runJob(job, db, knex, config, logger, body);
    return { jobId: job.id, token: job.token };
}

function authorizedJob(
    query: CashFlowForecastProgressQuery
): MutableForecastJob | undefined {
    cleanupExpiredJobs();
    const job = jobs.get(query.jobId);
    return job && job.token === query.token ? job : undefined;
}

function waitForEvent(
    job: MutableForecastJob,
    signal: AbortSignal
): Promise<void> {
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

export async function* subscribeCashFlowForecastJob(
    query: CashFlowForecastProgressQuery,
    signal: AbortSignal
): AsyncGenerator<CashFlowForecastProgressEvent> {
    const job = authorizedJob(query);
    if (!job) {
        yield {
            jobId: query.jobId,
            stage: 'failed',
            message: 'Forecast job was not found.',
            progress: 100,
            forecast: null,
            error: 'Forecast job was not found.'
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
