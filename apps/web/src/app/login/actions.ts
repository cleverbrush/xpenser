'use server';

import { redirect } from 'next/navigation';
import { client } from '../../lib/api-client';
import { setAuthCookie } from '../../lib/auth';

export async function loginAction(formData: FormData): Promise<void> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) return;

  const result = await client.auth.login({ body: { email, password } }) as { token?: string; expiresIn?: number } | undefined;
  if (result?.token && result?.expiresIn) {
    await setAuthCookie(result.token, result.expiresIn);
    redirect('/');
  }
}
