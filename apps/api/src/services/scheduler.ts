import { JobScheduler } from '@cleverbrush/scheduler';
import type { DbContext } from '@cleverbrush/orm';
import type { Logger } from '@cleverbrush/log';
import type { AppEntityMap } from '../db/schemas.js';
import { fetchExchangeRates, storeExchangeRates } from './currency.js';
import { ExchangeRatesUpdated } from '../logTemplates.js';

export function startExchangeRateScheduler(
  db: DbContext<AppEntityMap>,
  logger: Logger,
): JobScheduler {
  const scheduler = new JobScheduler({
    jobs: [
      {
        name: 'fetch-exchange-rates',
        schedule: '0 4 * * *',
        task: async () => {
          try {
            const rates = await fetchExchangeRates('USD');
            await storeExchangeRates(db, 'USD', rates);
            logger.info(ExchangeRatesUpdated, {
              BaseCurrency: 'USD',
              Count: rates.size,
            });
          } catch (err) {
            logger.error('Failed to fetch exchange rates: {Error}', {
              Error: String(err),
            });
          }
        },
      },
    ],
  });

  scheduler.start();

  fetchExchangeRates('USD')
    .then((rates) => storeExchangeRates(db, 'USD', rates))
    .then(() =>
      logger.info(ExchangeRatesUpdated, { BaseCurrency: 'USD', Count: 0 }),
    )
    .catch((err) =>
      logger.error('Initial exchange rate fetch failed: {Error}', {
        Error: String(err),
      }),
    );

  return scheduler;
}
