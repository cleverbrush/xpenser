import { signJwt } from '@cleverbrush/auth';
import type { Config } from '../config.js';

/** Issues a short application JWT consumed by @cleverbrush/server auth. */
export function issueToken(
    config: Config,
    user: { readonly id: number; readonly role: string },
    expiresInSeconds = config.jwt.expiresInSeconds,
    now = new Date()
): string {
    const exp = Math.floor(now.getTime() / 1000) + expiresInSeconds;
    return signJwt(
        { sub: String(user.id), role: user.role, exp },
        config.jwt.secret
    );
}

export function tokenExpiresAt(
    expiresInSeconds: number,
    now = new Date()
): Date {
    return new Date(now.getTime() + expiresInSeconds * 1000);
}
