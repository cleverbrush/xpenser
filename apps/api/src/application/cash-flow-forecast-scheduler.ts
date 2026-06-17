import type { Logger } from '@cleverbrush/log';
import { dateToLocalDateParam } from '@xpenser/timezone';
import type { Knex } from 'knex';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';
import {
    cashFlowForecastVersion,
    generateAndPersistCashFlowForecast
} from './cash-flow-forecast.js';

type SchedulerOptions = {
    readonly config: Config;
    readonly db: AppDb;
    readonly knex: Knex;
    readonly logger: Logger;
};

type ForecastSchedulerUser = {
    readonly id: number;
    readonly timezone: string;
};

export type CashFlowForecastScheduler = {
    readonly stop: () => void;
};

async function listForecastUsers(knex: Knex): Promise<ForecastSchedulerUser[]> {
    return knex<ForecastSchedulerUser>('users as app_user')
        .select('app_user.id', 'app_user.timezone')
        .whereExists(function activeTransactions() {
            this.select(knex.raw('1'))
                .from('transactions as txn')
                .whereRaw('txn.user_id = app_user.id');
        });
}

async function hasForecastForDate(
    knex: Knex,
    userId: number,
    forecastDate: string
): Promise<boolean> {
    const row = await knex('cash_flow_forecasts')
        .select('id')
        .where({
            user_id: userId,
            forecast_date: forecastDate,
            forecast_version: cashFlowForecastVersion
        })
        .first();
    return Boolean(row);
}

export async function generateDailyCashFlowForecasts(
    db: AppDb,
    knex: Knex,
    config: Config,
    logger: Logger
): Promise<number> {
    if (!config.openai.apiKey) {
        logger.info(
            'Cash-flow forecast scheduler skipped without OpenAI key',
            {}
        );
        return 0;
    }

    const now = new Date();
    const users = await listForecastUsers(knex);
    let generated = 0;
    for (const user of users) {
        const forecastDate = dateToLocalDateParam(now, user.timezone);
        if (await hasForecastForDate(knex, user.id, forecastDate)) {
            continue;
        }

        const result = await generateAndPersistCashFlowForecast(
            db,
            knex,
            config,
            logger,
            user.id,
            { date: now },
            { force: false }
        );
        generated += result.status === 'complete' ? 1 : 0;
    }

    return generated;
}

export function startCashFlowForecastScheduler({
    config,
    db,
    knex,
    logger
}: SchedulerOptions): CashFlowForecastScheduler {
    if (!config.cashFlowForecasts.schedulerEnabled || !config.openai.apiKey) {
        logger.info('Cash-flow forecast scheduler disabled', {});
        return { stop: () => undefined };
    }

    let running = false;
    const run = async () => {
        if (running) {
            return;
        }
        running = true;
        try {
            const generated = await generateDailyCashFlowForecasts(
                db,
                knex,
                config,
                logger
            );
            logger.info('Daily cash-flow forecasts generated', {
                Count: generated
            });
        } catch (err) {
            logger.error('Cash-flow forecast scheduler failed', {
                Error: err instanceof Error ? err.message : String(err)
            });
        } finally {
            running = false;
        }
    };

    const startup = setTimeout(() => {
        void run();
    }, 45_000);
    startup.unref();

    const interval = setInterval(
        () => {
            void run();
        },
        60 * 60 * 1000
    );
    interval.unref();

    logger.info('Cash-flow forecast scheduler started', {});

    return {
        stop: () => {
            clearTimeout(startup);
            clearInterval(interval);
        }
    };
}
