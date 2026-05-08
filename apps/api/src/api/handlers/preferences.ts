import { ActionResult, type Handler } from '@cleverbrush/server';
import { convertAmount, getAvailableCurrencies } from '../../services/currency.js';
import type {
  GetProfileEndpoint,
  UpdateProfileEndpoint,
  ListCurrenciesEndpoint,
  ConvertCurrencyEndpoint,
} from '../endpoints.js';

export const getProfileHandler: Handler<typeof GetProfileEndpoint> = async (
  _ctx,
  { db },
) => {
  const userId = Number((ctx.principal as { claims: { sub: string } }).claims.sub);
  const user = await db.users.projected('public').find(userId);

  if (!user) {
    return ActionResult.notFound({ message: 'User not found.' });
  }
  return ActionResult.ok(user);
};

export const updateProfileHandler: Handler<typeof UpdateProfileEndpoint> = async (
  { body },
  { db },
) => {
  const userId = Number((ctx.principal as { claims: { sub: string } }).claims.sub);
  const user = await db.users.find(userId);

  if (!user) {
    return ActionResult.notFound({ message: 'User not found.' });
  }

  if (body.defaultCurrency !== undefined) {
    user.defaultCurrency = body.defaultCurrency;
  }
  if (body.favoriteCurrencies !== undefined) {
    user.favoriteCurrencies = body.favoriteCurrencies;
  }

  await db.saveChanges();
  return ActionResult.ok(user);
};

export const listCurrenciesHandler: Handler<typeof ListCurrenciesEndpoint> = async () => {
  return ActionResult.ok(getAvailableCurrencies());
};

export const convertCurrencyHandler: Handler<typeof ConvertCurrencyEndpoint> = async (
  ctx,
  { db },
) => {
  const from = (ctx.query as { from?: string }).from ?? 'USD';
  const to = (ctx.query as { to?: string }).to ?? 'USD';
  const amount = Number((ctx.query as { amount?: string }).amount ?? 0);

  const result = await convertAmount(db, amount, from, to);
  return ActionResult.ok({ amount: result, from, to });
};
