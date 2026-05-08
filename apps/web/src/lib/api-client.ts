import { api } from '@xpenser/contract/api';
import { createClient } from '@cleverbrush/client';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let _tokenCache: string | undefined;
let _tokenCacheTime = 0;

function getCachedToken(): string | null {
  const now = Date.now();
  if (now - _tokenCacheTime < 5000 && _tokenCache !== undefined) return _tokenCache;
  return null;
}

export const client = createClient(api, {
  baseUrl: API_URL,
  getToken: () => getCachedToken(),
  middlewares: [],
});
