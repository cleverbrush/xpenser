import { string, number, object } from '@cleverbrush/schema';

export const RegisterBodySchema = object({
  email: string(),
  password: string(),
  defaultCurrency: string(),
  favoriteCurrencies: string(),
});

export const LoginBodySchema = object({
  email: string(),
  password: string(),
});

export const GoogleAuthBodySchema = object({
  idToken: string(),
});

export const TokenResponseSchema = object({
  token: string(),
  expiresIn: number(),
});
