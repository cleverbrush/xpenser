import type { UserDbSchema } from '../db/schemas.js';

export function mapUserPublic(user: typeof UserDbSchema['~outputType']) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    authProvider: user.authProvider,
    defaultCurrency: user.defaultCurrency,
    favoriteCurrencies: user.favoriteCurrencies,
    createdAt: user.createdAt.toISOString(),
  };
}
