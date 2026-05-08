'use server';

import { revalidateTag } from 'next/cache';

const TRANSACTIONS_TAG = 'transactions';
const CATEGORIES_TAG = 'categories';
const DASHBOARD_TAG = 'dashboard';
const USER_TAG = 'user';

export async function invalidateUserCache(userId: number) {
  revalidateTag(`${USER_TAG}:${userId}:${TRANSACTIONS_TAG}`, {});
  revalidateTag(`${USER_TAG}:${userId}:${CATEGORIES_TAG}`, {});
  revalidateTag(`${USER_TAG}:${userId}:${DASHBOARD_TAG}`, {});
  revalidateTag(`${USER_TAG}:${userId}:${USER_TAG}`, {});
}
