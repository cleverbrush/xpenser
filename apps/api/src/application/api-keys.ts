import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mapper } from '@cleverbrush/mapper';
import type {
    ApiKey,
    CreateApiKeyBody,
    CreateApiKeyResponse
} from '@xpenser/contracts';
import { ApiKeySchema } from '@xpenser/contracts';
import {
    type ApiKeyDb,
    ApiKeyDbSchema,
    type AppDb,
    type UserDb
} from '../db/schemas.js';

const keyPattern = /^xpk_([a-f0-9]{24})_([A-Za-z0-9_-]{43})$/;

type ApiKeyMaterial = {
    readonly key: string;
    readonly keyId: string;
    readonly secret: string;
    readonly keyPrefix: string;
};

export type ApiKeyPrincipal = {
    readonly userId: number;
    readonly role: string;
    readonly apiKeyId: number;
};

export class ApiKeyNotFoundError extends Error {}

const mapApiKeyRow = mapper()
    .configure(ApiKeyDbSchema, ApiKeySchema, mapping => mapping)
    .getMapper(ApiKeyDbSchema, ApiKeySchema);

function mapApiKey(row: ApiKeyDb): Promise<ApiKey> {
    return mapApiKeyRow({
        ...row,
        lastUsedAt: row.lastUsedAt ?? undefined,
        revokedAt: row.revokedAt ?? undefined
    });
}

export function generateApiKeyMaterial(): ApiKeyMaterial {
    const keyId = randomBytes(12).toString('hex');
    const secret = randomBytes(32).toString('base64url');
    const key = `xpk_${keyId}_${secret}`;
    return {
        key,
        keyId,
        secret,
        keyPrefix: `${key.slice(0, 16)}...`
    };
}

export function parseApiKey(
    value: string
): { readonly keyId: string; readonly secret: string } | undefined {
    const match = keyPattern.exec(value.trim());
    if (!match) {
        return undefined;
    }
    return { keyId: match[1]!, secret: match[2]! };
}

export function hashApiKeySecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
}

export function verifyApiKeySecret(
    secret: string,
    storedHash: string
): boolean {
    const expected = Buffer.from(storedHash, 'hex');
    const actual = Buffer.from(hashApiKeySecret(secret), 'hex');
    return (
        expected.length === actual.length && timingSafeEqual(expected, actual)
    );
}

export async function listApiKeys(
    db: AppDb,
    userId: number
): Promise<ApiKey[]> {
    const rows = (await db.apiKeys
        .where(key => key.userId, userId)
        .orderBy(key => key.createdAt, 'desc')) as ApiKeyDb[];
    return Promise.all(rows.filter(row => !row.revokedAt).map(mapApiKey));
}

export async function createApiKey(
    db: AppDb,
    userId: number,
    body: CreateApiKeyBody
): Promise<CreateApiKeyResponse> {
    const material = generateApiKeyMaterial();
    const created = (await db.apiKeys.insert({
        userId,
        name: body.name.trim(),
        keyId: material.keyId,
        keyPrefix: material.keyPrefix,
        secretHash: hashApiKeySecret(material.secret),
        lastUsedAt: undefined,
        revokedAt: undefined
    })) as ApiKeyDb;

    return {
        key: material.key,
        apiKey: await mapApiKey(created)
    };
}

export async function revokeApiKey(
    db: AppDb,
    userId: number,
    apiKeyId: number
): Promise<void> {
    const apiKey = (await db.apiKeys
        .where(key => key.id, apiKeyId)
        .where(key => key.userId, userId)
        .first()) as ApiKeyDb | undefined;
    if (!apiKey || apiKey.revokedAt) {
        throw new ApiKeyNotFoundError('API key was not found.');
    }

    await db.apiKeys
        .where(key => key.id, apiKeyId)
        .where(key => key.userId, userId)
        .update({ revokedAt: new Date() });
}

export async function authenticateApiKey(
    db: AppDb,
    token: string
): Promise<ApiKeyPrincipal | undefined> {
    const parsed = parseApiKey(token);
    if (!parsed) {
        return undefined;
    }

    const apiKey = (await db.apiKeys
        .where(candidate => candidate.keyId, parsed.keyId)
        .first()) as ApiKeyDb | undefined;
    if (
        !apiKey ||
        apiKey.revokedAt ||
        !verifyApiKeySecret(parsed.secret, apiKey.secretHash)
    ) {
        return undefined;
    }

    const user = (await db.users.find(apiKey.userId)) as UserDb | undefined;
    if (!user) {
        return undefined;
    }

    await db.apiKeys
        .where(candidate => candidate.id, apiKey.id)
        .update({ lastUsedAt: new Date() });

    return {
        userId: user.id,
        role: user.role,
        apiKeyId: apiKey.id
    };
}
