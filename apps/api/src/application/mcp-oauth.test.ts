import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';
import {
    authenticateMcpOAuthAccessToken,
    authorizeMcpOAuthRequest,
    exchangeMcpOAuthToken,
    getMcpOAuthAuthorizationRequest,
    listMcpOAuthConnections,
    OAuthError,
    registerMcpOAuthClient,
    revokeMcpOAuthConnection
} from './mcp-oauth.js';

type Row = Record<string, unknown> & { id: number };

const config = {
    jwt: { secret: 'x'.repeat(32) }
} as Config;

function propertyProxy() {
    return new Proxy(
        {},
        {
            get: (_target, prop) => String(prop)
        }
    );
}

type AwaitableQuery<T extends Row> = Query<T> & PromiseLike<T[]>;

class Query<T extends Row> {
    private readonly filters: Array<(row: T) => boolean> = [];
    private order:
        | { readonly key: keyof T; readonly direction: 'asc' | 'desc' }
        | undefined;

    constructor(private readonly table: Table<T>) {}

    where(selector: (row: T) => unknown, value: unknown): this {
        const key = selector(propertyProxy() as T) as keyof T;
        this.filters.push(row => row[key] === value);
        return this;
    }

    orderBy(selector: (row: T) => unknown, direction: 'asc' | 'desc'): this {
        this.order = {
            key: selector(propertyProxy() as T) as keyof T,
            direction
        };
        return this;
    }

    async first(): Promise<T | undefined> {
        return this.toArray()[0];
    }

    async update(patch: Partial<T>): Promise<void> {
        for (const row of this.toArray()) {
            Object.assign(row, patch);
        }
    }

    toArray(): T[] {
        const filtered = this.table.rows.filter(row =>
            this.filters.every(filter => filter(row))
        );
        if (!this.order) {
            return filtered;
        }
        const { direction, key } = this.order;
        return [...filtered].sort((left, right) => {
            const leftValue = left[key];
            const rightValue = right[key];
            const delta =
                leftValue instanceof Date && rightValue instanceof Date
                    ? leftValue.getTime() - rightValue.getTime()
                    : String(leftValue).localeCompare(String(rightValue));
            return direction === 'asc' ? delta : -delta;
        });
    }
}

function query<T extends Row>(table: Table<T>): AwaitableQuery<T> {
    const result = new Query(table) as AwaitableQuery<T>;
    Object.defineProperty(result, 'then', {
        value: (
            onfulfilled?: ((value: T[]) => unknown) | null,
            onrejected?: ((reason: unknown) => unknown) | null
        ) => Promise.resolve(result.toArray()).then(onfulfilled, onrejected)
    });
    return result;
}

class Table<T extends Row> {
    readonly rows: T[] = [];
    private nextId = 1;

    constructor(initialRows: T[] = []) {
        this.rows.push(...initialRows);
        this.nextId =
            Math.max(0, ...initialRows.map(row => Number(row.id))) + 1;
    }

    where(selector: (row: T) => unknown, value: unknown): AwaitableQuery<T> {
        return query(this).where(selector, value);
    }

    async find(id: number): Promise<T | undefined> {
        return this.rows.find(row => row.id === id);
    }

    async insert(value: Omit<Partial<T>, 'id'>): Promise<T> {
        const row = {
            id: this.nextId++,
            createdAt: new Date(),
            ...value
        } as unknown as T;
        this.rows.push(row);
        return row;
    }
}

function testDb(): AppDb {
    const db = {
        users: new Table([
            {
                id: 1,
                email: 'jane@example.com',
                role: 'user',
                emailVerified: true
            } as Row
        ]),
        mcpOAuthClients: new Table<Row>(),
        mcpOAuthGrants: new Table<Row>(),
        mcpOAuthAuthorizationCodes: new Table<Row>(),
        mcpOAuthRefreshTokens: new Table<Row>(),
        transaction: async <T>(callback: (trx: AppDb) => Promise<T>) =>
            callback(db as unknown as AppDb)
    };
    return db as unknown as AppDb;
}

function pkceChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
}

describe('MCP OAuth helpers', () => {
    it('registers public clients and rejects unsafe redirect URIs', async () => {
        const db = testDb();

        await expect(
            registerMcpOAuthClient(db, {
                client_name: 'Claude',
                redirect_uris: ['http://example.com/callback']
            })
        ).rejects.toBeInstanceOf(OAuthError);

        const registered = await registerMcpOAuthClient(db, {
            client_name: 'Claude',
            redirect_uris: ['https://claude.ai/api/mcp/auth_callback']
        });

        expect(registered.client_name).toBe('Claude');
        expect(registered.token_endpoint_auth_method).toBe('none');
        expect(registered.grant_types).toEqual([
            'authorization_code',
            'refresh_token'
        ]);
    });

    it('issues, refreshes, authenticates, and revokes MCP OAuth tokens', async () => {
        const db = testDb();
        const verifier = 'verifier-'.repeat(8);
        const registered = await registerMcpOAuthClient(db, {
            client_name: 'Codex',
            redirect_uris: ['http://localhost/callback']
        });
        const query = {
            response_type: 'code',
            client_id: registered.client_id,
            redirect_uri: 'http://localhost/callback',
            code_challenge: pkceChallenge(verifier),
            code_challenge_method: 'S256',
            state: 'state-1',
            scope: 'mcp'
        };

        await expect(
            getMcpOAuthAuthorizationRequest(db, query)
        ).resolves.toMatchObject({
            clientName: 'Codex',
            redirectUri: 'http://localhost/callback'
        });

        const approved = await authorizeMcpOAuthRequest(db, 1, query);
        const code = new URL(approved.redirectUrl).searchParams.get('code');
        expect(code).toBeTruthy();

        const token = await exchangeMcpOAuthToken(db, config, {
            grant_type: 'authorization_code',
            client_id: registered.client_id,
            code: code ?? '',
            redirect_uri: query.redirect_uri,
            code_verifier: verifier
        });

        expect(token.token_type).toBe('Bearer');
        await expect(
            exchangeMcpOAuthToken(db, config, {
                grant_type: 'authorization_code',
                client_id: registered.client_id,
                code: code ?? '',
                redirect_uri: query.redirect_uri,
                code_verifier: verifier
            })
        ).rejects.toMatchObject({ error: 'invalid_grant' });

        const refreshed = await exchangeMcpOAuthToken(db, config, {
            grant_type: 'refresh_token',
            client_id: registered.client_id,
            refresh_token: token.refresh_token
        });
        expect(refreshed.refresh_token).not.toBe(token.refresh_token);
        await expect(
            exchangeMcpOAuthToken(db, config, {
                grant_type: 'refresh_token',
                client_id: registered.client_id,
                refresh_token: token.refresh_token
            })
        ).rejects.toMatchObject({ error: 'invalid_grant' });

        await expect(
            authenticateMcpOAuthAccessToken(db, config, refreshed.access_token)
        ).resolves.toMatchObject({
            authType: 'mcp_oauth',
            userId: 1,
            mcpClientId: registered.client_id
        });

        const connections = await listMcpOAuthConnections(db, 1);
        expect(connections).toHaveLength(1);
        await revokeMcpOAuthConnection(db, 1, connections[0]!.id);
        await expect(listMcpOAuthConnections(db, 1)).resolves.toEqual([]);
        await expect(
            authenticateMcpOAuthAccessToken(db, config, refreshed.access_token)
        ).resolves.toBeUndefined();
    });
});
