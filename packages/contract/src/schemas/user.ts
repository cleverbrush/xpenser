import { string, number, object, array } from '@cleverbrush/schema';

export const UserResponseSchema = object({
  id: number(),
  email: string(),
  role: string(),
  authProvider: string(),
  defaultCurrency: string(),
  favoriteCurrencies: array(string()),
  createdAt: string(),
});
