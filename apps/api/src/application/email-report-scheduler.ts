import type { Logger } from '@cleverbrush/log';
import type { Knex } from 'knex';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';
import { sendDueEmailReports } from './email-reports.js';

type SchedulerOptions = {
    readonly config: Config;
    readonly db: AppDb;
    readonly knex: Knex;
    readonly logger: Logger;
};

export type EmailReportScheduler = {
    readonly stop: () => void;
};

export function startEmailReportScheduler({
    config,
    db,
    knex,
    logger
}: SchedulerOptions): EmailReportScheduler {
    if (!config.emailReports.enabled || !config.emailReports.schedulerEnabled) {
        logger.info('Email report scheduler disabled', {});
        return { stop: () => undefined };
    }

    let running = false;
    const run = async () => {
        if (running) {
            return;
        }
        running = true;
        try {
            await sendDueEmailReports(db, knex, config, logger);
        } catch (err) {
            logger.error('Email report scheduler failed', {
                Error: err instanceof Error ? err.message : String(err)
            });
        } finally {
            running = false;
        }
    };

    const startup = setTimeout(() => {
        void run();
    }, 30_000);
    startup.unref();

    const interval = setInterval(
        () => {
            void run();
        },
        60 * 60 * 1000
    );
    interval.unref();

    logger.info('Email report scheduler started', {});

    return {
        stop: () => {
            clearTimeout(startup);
            clearInterval(interval);
        }
    };
}
