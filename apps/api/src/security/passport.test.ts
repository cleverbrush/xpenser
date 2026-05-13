import { generateKeyPairSync } from 'node:crypto';
import { signJwt } from '@cleverbrush/auth';
import { describe, expect, it } from 'vitest';
import type { Config } from '../config.js';
import {
    authenticatePassportAccessToken,
    authenticatePassportInternalToken,
    PassportAuthError
} from './passport.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const config = {
    passport: {
        baseUrl: 'https://auth.cleverbrush.com',
        project: 'xpenser',
        environment: 'production',
        publicKey: Buffer.from(publicKey, 'utf8').toString('base64')
    }
} as Config;

function passportToken(
    claims: Record<string, unknown> = {},
    expiresInSeconds = 60
): string {
    return signJwt(
        {
            iss: 'https://auth.cleverbrush.com',
            aud: ['xpenser', 'xpenser:production'],
            sub: 'passport',
            env: 'production',
            roles: ['internal:resolve-user'],
            exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
            ...claims
        },
        privateKey,
        'RS256'
    );
}

describe('Passport token authentication', () => {
    it('accepts a valid internal resolve-user token', async () => {
        await expect(
            authenticatePassportInternalToken(
                config,
                `Bearer ${passportToken()}`
            )
        ).resolves.toMatchObject({
            sub: 'passport',
            env: 'production',
            roles: ['internal:resolve-user']
        });
    });

    it('rejects internal tokens without the resolve-user role', async () => {
        await expect(
            authenticatePassportInternalToken(
                config,
                `Bearer ${passportToken({ roles: ['user'] })}`
            )
        ).rejects.toBeInstanceOf(PassportAuthError);
    });

    it('rejects tokens for another environment', async () => {
        await expect(
            authenticatePassportAccessToken(
                config,
                passportToken({
                    aud: ['xpenser', 'xpenser:preview'],
                    env: 'preview',
                    sub: '1',
                    roles: ['user']
                })
            )
        ).rejects.toBeInstanceOf(PassportAuthError);
    });

    it('accepts a valid user access token', async () => {
        await expect(
            authenticatePassportAccessToken(
                config,
                passportToken({ sub: '12', roles: ['user'] })
            )
        ).resolves.toMatchObject({
            sub: '12',
            env: 'production',
            roles: ['user']
        });
    });
});
