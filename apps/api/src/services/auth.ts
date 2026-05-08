import { scrypt, randomBytes, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { signJwt, verifyJwt } from '@cleverbrush/auth';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS: ScryptOptions = { N: 16384, r: 8, p: 1 };

function scryptAsync(
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const storedBuf = Buffer.from(hashHex, 'hex');
  const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  if (derived.length !== storedBuf.length) return false;
  return timingSafeEqual(derived, storedBuf);
}

export function issueToken(userId: number, role: string): string {
  const exp = Math.floor(Date.now() / 1000) + config.jwt.expiresInSeconds;
  return signJwt({ sub: String(userId), role, exp }, config.jwt.secret);
}

export function verifyToken(token: string): { sub: string; role: string } | null {
  try {
    const claims = verifyJwt(token, config.jwt.secret);
    return {
      sub: claims.sub as string,
      role: (claims as { role?: string }).role ?? 'user',
    };
  } catch {
    return null;
  }
}

export async function verifyGoogleToken(
  idToken: string,
): Promise<{ email: string; name: string } | null> {
  if (!config.google.clientId) return null;
  try {
    const client = new OAuth2Client(config.google.clientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.google.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) return null;
    return { email: payload.email, name: payload.name ?? payload.email };
  } catch {
    return null;
  }
}
