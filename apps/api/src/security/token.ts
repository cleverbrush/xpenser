import { signJwt } from '@cleverbrush/auth';
import type { Config } from '../config.js';

/** Issues a short application JWT consumed by @cleverbrush/server auth. */
export function issueToken(
    config: Config,
    user: { readonly id: number; readonly role: string }
): string {
    const exp = Math.floor(Date.now() / 1000) + config.jwt.expiresInSeconds;
    return signJwt(
        { sub: String(user.id), role: user.role, exp },
        config.jwt.secret
    );
}
