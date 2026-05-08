import { ActionResult, type Handler, ForbiddenError, BadRequestError } from '@cleverbrush/server';
import { hashPassword, verifyPassword, issueToken, verifyGoogleToken } from '../../services/auth.js';
import type { RegisterEndpoint, LoginEndpoint, GoogleLoginEndpoint } from '../endpoints.js';

export const registerHandler: Handler<typeof RegisterEndpoint> = async (
  { body },
  { db },
) => {
  const existing = await db.users
    .projected('public')
    .where((t) => t.email, body.email)
    .first();

  if (existing) {
    return ActionResult.badRequest({ message: 'Email is already registered.' });
  }

  const passwordHash = await hashPassword(body.password);
  const user = await db.users.insert({
    email: body.email,
    passwordHash,
    role: 'user',
    authProvider: 'local',
    defaultCurrency: body.defaultCurrency,
    favoriteCurrencies: body.favoriteCurrencies,
  });

  const token = issueToken(user.id, 'user');
  return ActionResult.created({ token, expiresIn: 3600 });
};

export const loginHandler: Handler<typeof LoginEndpoint> = async (
  { body },
  { db },
) => {
  const user = await db.users
    .projected('auth')
    .where((t) => t.email, body.email)
    .first();

  if (!user || !user.passwordHash) {
    return ActionResult.unauthorized({ message: 'Invalid email or password.' });
  }

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    return ActionResult.unauthorized({ message: 'Invalid email or password.' });
  }

  const token = issueToken(user.id, user.role);
  return ActionResult.ok({ token, expiresIn: 3600 });
};

export const googleLoginHandler: Handler<typeof GoogleLoginEndpoint> = async (
  { body },
  { db },
) => {
  const profile = await verifyGoogleToken(body.idToken);
  if (!profile) {
    return ActionResult.badRequest({ message: 'Invalid Google token.' });
  }

  let user = await db.users
    .projected('auth')
    .where((t) => t.email, profile.email)
    .first();

  if (!user) {
    const created = await db.users.insert({
      email: profile.email,
      passwordHash: null,
      role: 'user',
      authProvider: 'google',
      defaultCurrency: 'USD',
      favoriteCurrencies: ['USD'],
    });
    const token = issueToken(created.id, 'user');
    return ActionResult.ok({ token, expiresIn: 3600 });
  }

  const token = issueToken(user.id, user.role);
  return ActionResult.ok({ token, expiresIn: 3600 });
};
