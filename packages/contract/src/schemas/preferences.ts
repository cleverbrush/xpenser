import { string, object } from '@cleverbrush/schema';

export const UpdatePreferencesBodySchema = object({
  defaultCurrency: string(),
  favoriteCurrencies: string(),
});
