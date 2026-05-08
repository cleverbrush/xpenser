import { cookies } from 'next/headers';

export interface Session {
  userId: number;
  role: string;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('xpenser_token')?.value;
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload?.sub) return null;

  const exp = payload.exp as number | undefined;
  if (exp && exp < Math.floor(Date.now() / 1000)) return null;

  return {
    userId: Number(payload.sub),
    role: (payload.role as string) ?? 'user',
  };
}

export async function setAuthCookie(token: string, expiresIn: number): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('xpenser_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: expiresIn,
    path: '/',
  });
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('xpenser_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 0,
    path: '/',
  });
}
