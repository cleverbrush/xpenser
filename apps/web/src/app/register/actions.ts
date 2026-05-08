'use server';

import { redirect } from 'next/navigation';
import { client } from '../../lib/api-client';
import { setAuthCookie } from '../../lib/auth';

export async function registerAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;
  const defaultCurrency = (formData.get('defaultCurrency') as string) || 'USD';
  const favoriteCurrencies = formData.getAll('favoriteCurrencies') as string[];

  if (!email || !password || password !== confirmPassword || favoriteCurrencies.length === 0) {
    return;
  }

  const result = await client.auth.register({
    body: { email, password, defaultCurrency, favoriteCurrencies },
  }) as { token?: string; expiresIn?: number } | undefined;

  if (result?.token && result?.expiresIn) {
    await setAuthCookie(result.token, result.expiresIn);
    redirect('/settings/categories');
  }
}
