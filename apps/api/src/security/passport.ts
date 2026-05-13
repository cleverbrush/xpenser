import { type JwtPayload, jwtScheme } from '@cleverbrush/auth';
import type { Config } from '../config.js';

export class PassportAuthError extends Error {}

export type PassportClaims = {
    readonly sub: string;
    readonly aud: readonly string[];
    readonly env: string;
    readonly project?: string;
    readonly roles: readonly string[];
};

type PassportPublicKeyResponse = {
    readonly publicKeyPem?: string;
};

type PassportTokenResponse = {
    readonly access_token?: string;
    readonly refresh_token?: string;
};

const publicKeyCache = new Map<string, string>();

function passportIssuer(config: Config): string {
    return config.passport.baseUrl.replace(/\/+$/, '');
}

function decodeConfiguredPublicKey(value: string): string {
    const normalized = value.replace(/\\n/g, '\n');
    if (normalized.includes('BEGIN PUBLIC KEY')) {
        return normalized;
    }
    return Buffer.from(normalized, 'base64').toString('utf8');
}

async function passportPublicKey(config: Config): Promise<string> {
    if (config.passport.publicKey) {
        return decodeConfiguredPublicKey(config.passport.publicKey);
    }

    const issuer = passportIssuer(config);
    const cached = publicKeyCache.get(issuer);
    if (cached) {
        return cached;
    }

    const response = await fetch(`${issuer}/.well-known/public-key`, {
        signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
        throw new PassportAuthError(
            `Passport public key request failed with ${response.status}`
        );
    }

    const body = (await response.json()) as PassportPublicKeyResponse;
    if (!body.publicKeyPem) {
        throw new PassportAuthError('Passport public key response is invalid.');
    }

    publicKeyCache.set(issuer, body.publicKeyPem);
    return body.publicKeyPem;
}

function stringValues(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string');
    }
    return typeof value === 'string' ? [value] : [];
}

function mapClaims(claims: JwtPayload): PassportClaims {
    return {
        sub: claims.sub ?? '',
        aud: stringValues(claims.aud),
        env: typeof claims.env === 'string' ? claims.env : '',
        project:
            typeof claims.project === 'string' ? claims.project : undefined,
        roles: stringValues(claims.roles)
    };
}

function bearerToken(authorization: string | undefined): string {
    if (!authorization?.startsWith('Bearer ')) {
        throw new PassportAuthError('Missing Passport bearer token.');
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
        throw new PassportAuthError('Missing Passport bearer token.');
    }
    return token;
}

async function authenticatePassportToken(
    config: Config,
    token: string,
    audience: string
): Promise<PassportClaims> {
    const scheme = jwtScheme<PassportClaims>({
        secret: await passportPublicKey(config),
        algorithms: ['RS256'],
        issuer: passportIssuer(config),
        audience,
        clockTolerance: 5,
        mapClaims
    });

    const result = await scheme.authenticate({
        headers: { authorization: `Bearer ${token}` },
        cookies: {},
        items: new Map()
    });

    if (!result.succeeded || !result.principal.value) {
        throw new PassportAuthError(
            result.succeeded
                ? 'Passport token is invalid.'
                : (result.failure ?? 'Passport token is invalid.')
        );
    }

    const claims = result.principal.value;
    if (claims.env !== config.passport.environment) {
        throw new PassportAuthError('Passport token environment is invalid.');
    }
    return claims;
}

export async function authenticatePassportInternalToken(
    config: Config,
    authorization: string | undefined
): Promise<PassportClaims> {
    const claims = await authenticatePassportToken(
        config,
        bearerToken(authorization),
        `${config.passport.project}:${config.passport.environment}`
    );

    if (claims.sub !== 'passport') {
        throw new PassportAuthError('Passport internal subject is invalid.');
    }
    if (!claims.roles.includes('internal:resolve-user')) {
        throw new PassportAuthError('Passport internal role is missing.');
    }
    return claims;
}

export async function authenticatePassportAccessToken(
    config: Config,
    accessToken: string
): Promise<PassportClaims> {
    const claims = await authenticatePassportToken(
        config,
        accessToken,
        `${config.passport.project}:${config.passport.environment}`
    );

    if (!claims.sub) {
        throw new PassportAuthError(
            'Passport access token subject is missing.'
        );
    }
    return claims;
}

export async function exchangePassportCode(
    config: Config,
    code: string
): Promise<string> {
    const issuer = passportIssuer(config);
    const response = await fetch(`${issuer}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'authorization_code',
            code
        }),
        signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new PassportAuthError(
            `Passport token exchange failed with ${response.status}: ${body.substring(0, 200)}`
        );
    }

    const token = (await response.json()) as PassportTokenResponse;
    if (!token.access_token) {
        throw new PassportAuthError('Passport token response is invalid.');
    }

    if (token.refresh_token) {
        await revokePassportRefreshToken(config, token.refresh_token).catch(
            () => undefined
        );
    }

    return token.access_token;
}

async function revokePassportRefreshToken(
    config: Config,
    refreshToken: string
): Promise<void> {
    await fetch(`${passportIssuer(config)}/token/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
        signal: AbortSignal.timeout(10_000)
    });
}
