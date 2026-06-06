import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { jwtScheme, signJwt } from '@cleverbrush/auth';
import { array, string } from '@cleverbrush/schema';
import type {
    McpOAuthAuthorizationQuery,
    McpOAuthAuthorizationRequest,
    McpOAuthAuthorizeResponse,
    McpOAuthConnection
} from '@xpenser/contracts';
import type { Config } from '../config.js';
import type {
    AppDb,
    McpOAuthAuthorizationCodeDb,
    McpOAuthClientDb,
    McpOAuthGrantDb,
    McpOAuthRefreshTokenDb,
    UserDb
} from '../db/schemas.js';

const mcpScope = 'mcp';
const accessTokenTtlSeconds = 60 * 60;
const authorizationCodeTtlSeconds = 10 * 60;
const refreshTokenTtlSeconds = 30 * 24 * 60 * 60;
const StringArraySchema = array(string());

type DynamicClientRegistrationRequest = {
    readonly client_name?: unknown;
    readonly redirect_uris?: unknown;
    readonly grant_types?: unknown;
    readonly response_types?: unknown;
    readonly scope?: unknown;
    readonly token_endpoint_auth_method?: unknown;
};

type DynamicClientRegistrationResponse = {
    readonly client_id: string;
    readonly client_id_issued_at: number;
    readonly client_name: string;
    readonly redirect_uris: readonly string[];
    readonly grant_types: readonly string[];
    readonly response_types: readonly string[];
    readonly scope: string;
    readonly token_endpoint_auth_method: 'none';
};

export type McpOAuthTokenRequest = {
    readonly grant_type?: string;
    readonly client_id?: string;
    readonly code?: string;
    readonly redirect_uri?: string;
    readonly code_verifier?: string;
    readonly refresh_token?: string;
};

export type McpOAuthTokenResponse = {
    readonly access_token: string;
    readonly token_type: 'Bearer';
    readonly expires_in: number;
    readonly refresh_token: string;
    readonly scope: string;
};

export type McpOAuthAccessPrincipal = {
    readonly userId: number;
    readonly role: string;
    readonly authType: 'mcp_oauth';
    readonly mcpGrantId: number;
    readonly mcpClientId: string;
};

export class OAuthError extends Error {
    readonly status: number;
    readonly error: string;

    constructor(error: string, message: string, status = 400) {
        super(message);
        this.error = error;
        this.status = status;
    }
}

export class McpOAuthConnectionNotFoundError extends Error {}

function randomToken(): string {
    return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

function epochSeconds(value: Date): number {
    return Math.floor(value.getTime() / 1000);
}

function tokenExpiresAt(ttlSeconds: number, now = new Date()): Date {
    return new Date(now.getTime() + ttlSeconds * 1000);
}

function redirectUris(client: McpOAuthClientDb): string[] {
    return parseStringArray(JSON.parse(client.redirectUrisJson));
}

function parseStringArray(value: unknown): string[] {
    const result = StringArraySchema.safeParse(value);
    return result.valid ? (result.object ?? []) : [];
}

function stringArray(value: unknown): string[] | undefined {
    const result = StringArraySchema.safeParse(value);
    return result.valid ? (result.object ?? []) : undefined;
}

function oauthClientDisplayName(value: unknown): string {
    if (typeof value !== 'string') {
        return 'MCP client';
    }
    const trimmed = value.trim();
    return trimmed || 'MCP client';
}

function allowedRedirectUri(value: string): boolean {
    try {
        const url = new URL(value);
        if (url.protocol === 'https:') {
            return true;
        }
        if (url.protocol !== 'http:') {
            return false;
        }
        return (
            url.hostname === 'localhost' ||
            url.hostname === '127.0.0.1' ||
            url.hostname === '[::1]'
        );
    } catch {
        return false;
    }
}

function normalizeScope(scope: unknown): string {
    if (scope === undefined || scope === null || scope === '') {
        return mcpScope;
    }
    if (typeof scope !== 'string') {
        throw new OAuthError('invalid_scope', 'OAuth scope must be a string.');
    }
    const scopes = scope
        .split(/\s+/)
        .map(item => item.trim())
        .filter(Boolean);
    if (scopes.length === 0) {
        return mcpScope;
    }
    if (scopes.some(item => item !== mcpScope)) {
        throw new OAuthError(
            'invalid_scope',
            'xpenser MCP only supports the mcp scope.'
        );
    }
    return mcpScope;
}

function requireSupportedRegistration(body: DynamicClientRegistrationRequest) {
    if (
        body.token_endpoint_auth_method !== undefined &&
        body.token_endpoint_auth_method !== 'none'
    ) {
        throw new OAuthError(
            'invalid_client_metadata',
            'xpenser MCP OAuth supports public clients only.'
        );
    }
    if (
        stringArray(body.grant_types)?.includes('authorization_code') === false
    ) {
        throw new OAuthError(
            'invalid_client_metadata',
            'authorization_code grant type is required.'
        );
    }
    if (stringArray(body.response_types)?.includes('code') === false) {
        throw new OAuthError(
            'invalid_client_metadata',
            'code response type is required.'
        );
    }
}

function validateAuthorizationQuery(
    client: McpOAuthClientDb,
    query: McpOAuthAuthorizationQuery
): string {
    if (query.response_type !== 'code') {
        throw new OAuthError(
            'unsupported_response_type',
            'xpenser MCP OAuth supports authorization code only.'
        );
    }
    if (query.code_challenge_method !== 'S256') {
        throw new OAuthError(
            'invalid_request',
            'xpenser MCP OAuth requires S256 PKCE.'
        );
    }
    if (!query.code_challenge) {
        throw new OAuthError(
            'invalid_request',
            'PKCE code challenge required.'
        );
    }
    if (!redirectUris(client).includes(query.redirect_uri)) {
        throw new OAuthError(
            'invalid_request',
            'Redirect URI is not registered for this MCP client.'
        );
    }
    return normalizeScope(query.scope);
}

function appendOAuthRedirectParams(
    redirectUri: string,
    params: Record<string, string | undefined>
): string {
    const url = new URL(redirectUri);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
            url.searchParams.set(key, value);
        }
    }
    return url.toString();
}

function verifyPkce(verifier: string, challenge: string): boolean {
    const actual = Buffer.from(
        createHash('sha256').update(verifier).digest('base64url')
    );
    const expected = Buffer.from(challenge);
    return (
        actual.length === expected.length && timingSafeEqual(actual, expected)
    );
}

async function findOAuthClient(
    db: AppDb,
    clientId: string
): Promise<McpOAuthClientDb | undefined> {
    return (await db.mcpOAuthClients
        .where(client => client.clientId, clientId)
        .first()) as McpOAuthClientDb | undefined;
}

async function requireOAuthClient(
    db: AppDb,
    clientId: string
): Promise<McpOAuthClientDb> {
    const client = await findOAuthClient(db, clientId);
    if (!client) {
        throw new OAuthError('invalid_client', 'MCP OAuth client not found.');
    }
    return client;
}

async function activeGrant(
    db: AppDb,
    userId: number,
    clientId: number,
    scope: string
): Promise<McpOAuthGrantDb | undefined> {
    const rows = (await db.mcpOAuthGrants
        .where(grant => grant.userId, userId)
        .where(grant => grant.clientId, clientId)
        .where(grant => grant.scope, scope)) as McpOAuthGrantDb[];
    return rows.find(grant => !grant.revokedAt);
}

async function requireActiveGrant(
    db: AppDb,
    grantId: number
): Promise<McpOAuthGrantDb> {
    const grant = (await db.mcpOAuthGrants
        .where(candidate => candidate.id, grantId)
        .first()) as McpOAuthGrantDb | undefined;
    if (!grant || grant.revokedAt) {
        throw new OAuthError('invalid_grant', 'MCP OAuth grant is not active.');
    }
    return grant;
}

function issueAccessToken({
    client,
    config,
    grant,
    user
}: {
    readonly client: McpOAuthClientDb;
    readonly config: Config;
    readonly grant: McpOAuthGrantDb;
    readonly user: Pick<UserDb, 'id' | 'role'>;
}): string {
    const exp = Math.floor(Date.now() / 1000) + accessTokenTtlSeconds;
    return signJwt(
        {
            sub: String(user.id),
            role: user.role,
            auth_type: 'mcp_oauth',
            mcp_grant_id: String(grant.id),
            mcp_client_id: client.clientId,
            exp
        },
        config.jwt.secret
    );
}

async function createRefreshToken(
    db: AppDb,
    grant: McpOAuthGrantDb
): Promise<string> {
    const refreshToken = randomToken();
    await db.mcpOAuthRefreshTokens.insert({
        userId: grant.userId,
        clientId: grant.clientId,
        grantId: grant.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: tokenExpiresAt(refreshTokenTtlSeconds),
        revokedAt: undefined,
        lastUsedAt: undefined
    });
    return refreshToken;
}

async function tokenResponse({
    client,
    config,
    db,
    grant,
    user
}: {
    readonly client: McpOAuthClientDb;
    readonly config: Config;
    readonly db: AppDb;
    readonly grant: McpOAuthGrantDb;
    readonly user: Pick<UserDb, 'id' | 'role'>;
}): Promise<McpOAuthTokenResponse> {
    await db.mcpOAuthGrants
        .where(candidate => candidate.id, grant.id)
        .update({ lastUsedAt: new Date() });

    return {
        access_token: issueAccessToken({ client, config, grant, user }),
        token_type: 'Bearer',
        expires_in: accessTokenTtlSeconds,
        refresh_token: await createRefreshToken(db, grant),
        scope: grant.scope
    };
}

export async function registerMcpOAuthClient(
    db: AppDb,
    body: DynamicClientRegistrationRequest
): Promise<DynamicClientRegistrationResponse> {
    requireSupportedRegistration(body);
    const scope = normalizeScope(body.scope);
    const redirectUris = stringArray(body.redirect_uris);
    if (!redirectUris || redirectUris.length === 0) {
        throw new OAuthError(
            'invalid_client_metadata',
            'At least one redirect URI is required.'
        );
    }
    const uniqueRedirectUris = Array.from(new Set(redirectUris));
    if (uniqueRedirectUris.some(uri => !allowedRedirectUri(uri))) {
        throw new OAuthError(
            'invalid_client_metadata',
            'Redirect URIs must use HTTPS, except localhost loopback HTTP.'
        );
    }

    const created = (await db.mcpOAuthClients.insert({
        clientId: `xpenser_mcp_${randomBytes(18).toString('base64url')}`,
        clientName: oauthClientDisplayName(body.client_name),
        redirectUrisJson: JSON.stringify(uniqueRedirectUris),
        scope
    })) as McpOAuthClientDb;

    return {
        client_id: created.clientId,
        client_id_issued_at: epochSeconds(created.createdAt),
        client_name: created.clientName,
        redirect_uris: uniqueRedirectUris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope,
        token_endpoint_auth_method: 'none'
    };
}

export async function getMcpOAuthAuthorizationRequest(
    db: AppDb,
    query: McpOAuthAuthorizationQuery
): Promise<McpOAuthAuthorizationRequest> {
    const client = await requireOAuthClient(db, query.client_id);
    const scope = validateAuthorizationQuery(client, query);
    return {
        clientName: client.clientName,
        redirectUri: query.redirect_uri,
        scope
    };
}

export async function authorizeMcpOAuthRequest(
    db: AppDb,
    userId: number,
    query: McpOAuthAuthorizationQuery
): Promise<McpOAuthAuthorizeResponse> {
    const client = await requireOAuthClient(db, query.client_id);
    const scope = validateAuthorizationQuery(client, query);
    const code = randomToken();
    const redirectUrl = await db.transaction(async trx => {
        let grant = await activeGrant(trx, userId, client.id, scope);
        if (!grant) {
            grant = (await trx.mcpOAuthGrants.insert({
                userId,
                clientId: client.id,
                scope,
                revokedAt: undefined,
                lastUsedAt: undefined
            })) as McpOAuthGrantDb;
        }

        await trx.mcpOAuthAuthorizationCodes.insert({
            userId,
            clientId: client.id,
            grantId: grant.id,
            codeHash: hashToken(code),
            redirectUri: query.redirect_uri,
            codeChallenge: query.code_challenge,
            codeChallengeMethod: query.code_challenge_method,
            scope,
            expiresAt: tokenExpiresAt(authorizationCodeTtlSeconds),
            consumedAt: undefined
        });

        return appendOAuthRedirectParams(query.redirect_uri, {
            code,
            state: query.state
        });
    });

    return { redirectUrl };
}

export function denyMcpOAuthRequest(
    query: McpOAuthAuthorizationQuery
): McpOAuthAuthorizeResponse {
    return {
        redirectUrl: appendOAuthRedirectParams(query.redirect_uri, {
            error: 'access_denied',
            state: query.state
        })
    };
}

async function exchangeAuthorizationCode(
    db: AppDb,
    config: Config,
    request: McpOAuthTokenRequest
): Promise<McpOAuthTokenResponse> {
    if (
        !request.client_id ||
        !request.code ||
        !request.redirect_uri ||
        !request.code_verifier
    ) {
        throw new OAuthError(
            'invalid_request',
            'client_id, code, redirect_uri, and code_verifier are required.'
        );
    }

    const client = await requireOAuthClient(db, request.client_id);
    const code = (await db.mcpOAuthAuthorizationCodes
        .where(candidate => candidate.codeHash, hashToken(request.code ?? ''))
        .first()) as McpOAuthAuthorizationCodeDb | undefined;
    if (
        !code ||
        code.clientId !== client.id ||
        code.redirectUri !== request.redirect_uri ||
        code.consumedAt ||
        code.expiresAt.getTime() <= Date.now()
    ) {
        throw new OAuthError(
            'invalid_grant',
            'Authorization code is invalid or expired.'
        );
    }
    if (!verifyPkce(request.code_verifier, code.codeChallenge)) {
        throw new OAuthError('invalid_grant', 'PKCE verifier is invalid.');
    }

    const grant = await requireActiveGrant(db, code.grantId);
    const user = await db.users.find(code.userId);
    if (!user) {
        throw new OAuthError('invalid_grant', 'User was not found.');
    }

    await db.mcpOAuthAuthorizationCodes
        .where(candidate => candidate.id, code.id)
        .update({ consumedAt: new Date() });

    return tokenResponse({ client, config, db, grant, user });
}

async function exchangeRefreshToken(
    db: AppDb,
    config: Config,
    request: McpOAuthTokenRequest
): Promise<McpOAuthTokenResponse> {
    if (!request.client_id || !request.refresh_token) {
        throw new OAuthError(
            'invalid_request',
            'client_id and refresh_token are required.'
        );
    }

    const client = await requireOAuthClient(db, request.client_id);
    const refreshToken = (await db.mcpOAuthRefreshTokens
        .where(
            candidate => candidate.tokenHash,
            hashToken(request.refresh_token ?? '')
        )
        .first()) as McpOAuthRefreshTokenDb | undefined;
    if (
        !refreshToken ||
        refreshToken.clientId !== client.id ||
        refreshToken.revokedAt ||
        refreshToken.expiresAt.getTime() <= Date.now()
    ) {
        throw new OAuthError(
            'invalid_grant',
            'Refresh token is invalid or expired.'
        );
    }

    const grant = await requireActiveGrant(db, refreshToken.grantId);
    const user = await db.users.find(refreshToken.userId);
    if (!user) {
        throw new OAuthError('invalid_grant', 'User was not found.');
    }

    await db.mcpOAuthRefreshTokens
        .where(candidate => candidate.id, refreshToken.id)
        .update({ lastUsedAt: new Date(), revokedAt: new Date() });

    return tokenResponse({ client, config, db, grant, user });
}

export async function exchangeMcpOAuthToken(
    db: AppDb,
    config: Config,
    request: McpOAuthTokenRequest
): Promise<McpOAuthTokenResponse> {
    if (request.grant_type === 'authorization_code') {
        return exchangeAuthorizationCode(db, config, request);
    }
    if (request.grant_type === 'refresh_token') {
        return exchangeRefreshToken(db, config, request);
    }
    throw new OAuthError(
        'unsupported_grant_type',
        'xpenser MCP OAuth supports authorization_code and refresh_token.'
    );
}

export async function listMcpOAuthConnections(
    db: AppDb,
    userId: number
): Promise<McpOAuthConnection[]> {
    const grants = (await db.mcpOAuthGrants
        .where(grant => grant.userId, userId)
        .orderBy(grant => grant.createdAt, 'desc')) as McpOAuthGrantDb[];

    const active = grants.filter(grant => !grant.revokedAt);
    const clients = await Promise.all(
        active.map(grant => db.mcpOAuthClients.find(grant.clientId))
    );

    return active.flatMap((grant, index) => {
        const client = clients[index] as McpOAuthClientDb | undefined;
        if (!client) {
            return [];
        }
        return [
            {
                id: grant.id,
                clientId: client.clientId,
                clientName: client.clientName,
                createdAt: grant.createdAt,
                lastUsedAt: grant.lastUsedAt ?? undefined
            }
        ];
    });
}

export async function revokeMcpOAuthConnection(
    db: AppDb,
    userId: number,
    grantId: number
): Promise<void> {
    const grant = (await db.mcpOAuthGrants
        .where(candidate => candidate.id, grantId)
        .where(candidate => candidate.userId, userId)
        .first()) as McpOAuthGrantDb | undefined;
    if (!grant || grant.revokedAt) {
        throw new McpOAuthConnectionNotFoundError(
            'MCP connection was not found.'
        );
    }

    const revokedAt = new Date();
    await db.transaction(async trx => {
        await trx.mcpOAuthGrants
            .where(candidate => candidate.id, grantId)
            .update({ revokedAt });
        await trx.mcpOAuthRefreshTokens
            .where(candidate => candidate.grantId, grantId)
            .update({ revokedAt });
    });
}

export async function authenticateMcpOAuthAccessToken(
    db: AppDb,
    config: Config,
    token: string
): Promise<McpOAuthAccessPrincipal | undefined> {
    const scheme = jwtScheme({
        secret: config.jwt.secret,
        mapClaims: claims => ({
            userId: Number(claims.sub),
            role: claims.role as string,
            authType: claims.auth_type,
            mcpGrantId: Number(claims.mcp_grant_id),
            mcpClientId: claims.mcp_client_id
        })
    });
    const result = await scheme.authenticate({
        headers: { authorization: `Bearer ${token}` },
        cookies: {},
        items: new Map()
    });
    if (!result.succeeded || result.principal.value?.authType !== 'mcp_oauth') {
        return undefined;
    }

    const { mcpClientId, mcpGrantId, role, userId } = result.principal.value;
    if (
        typeof role !== 'string' ||
        typeof mcpClientId !== 'string' ||
        !Number.isSafeInteger(userId) ||
        !Number.isSafeInteger(mcpGrantId)
    ) {
        return undefined;
    }

    let grant: McpOAuthGrantDb;
    try {
        grant = await requireActiveGrant(db, mcpGrantId);
    } catch {
        return undefined;
    }
    const client = await db.mcpOAuthClients.find(grant.clientId);
    if (!client || client.clientId !== mcpClientId || grant.userId !== userId) {
        return undefined;
    }

    await db.mcpOAuthGrants
        .where(candidate => candidate.id, grant.id)
        .update({ lastUsedAt: new Date() });

    return {
        userId,
        role,
        authType: 'mcp_oauth',
        mcpGrantId,
        mcpClientId
    };
}
