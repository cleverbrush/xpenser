import { signJwt } from '@cleverbrush/auth';
import { createXpenserClient, decodeValidationIssues } from '@xpenser/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    BudgetAccessError,
    BudgetPermissionError
} from '../application/budgets.js';
import { TransactionScanJobs } from '../application/transaction-scan-jobs.js';
import * as transactions from '../application/transactions.js';
import * as users from '../application/users.js';
import * as vendors from '../application/vendors.js';
import type { Config } from '../config.js';
import { VendorUpdateValidationRejected } from '../log-templates.js';
import { buildServer } from '../server.js';

const config = {
    app: { url: 'http://localhost:3000' },
    api: { publicBaseUrl: 'http://localhost:4000' },
    jwt: { secret: 'x'.repeat(32) },
    web: { apiServiceSecret: 'test-service-secret-at-least-32-characters' }
} as Config;
const auth = {
    authorization: `Bearer ${signJwt({ sub: '42', role: 'user', exp: Math.floor(Date.now() / 1000) + 3600 }, config.jwt.secret)}`
};

afterEach(() => vi.restoreAllMocks());

async function withServer(
    run: (url: string, logger: ReturnType<typeof testLogger>) => Promise<void>,
    overrides: Partial<Config> = {}
) {
    const logger = testLogger();
    const server = buildServer(
        { ...config, ...overrides },
        logger as never,
        { db: {}, knex: {} } as never
    );
    const running = await server.listen(0, '127.0.0.1');
    try {
        await run(`http://127.0.0.1:${running.address!.port}`, logger);
    } finally {
        await running.close();
    }
}

function testLogger() {
    return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('registered implementation over HTTP', () => {
    it.each([
        true,
        false
    ])('decodes real HTTP validation errors (disableBatching=%s)', async disableBatching => {
        await withServer(async url => {
            const client = createXpenserClient({
                baseUrl: url,
                headers: auth,
                disableBatching
            });
            const failure = await client.categories
                .create({ body: { name: '', type: 'expense' } })
                .catch(error => error);
            expect(failure.status).toBe(400);
            const issues = decodeValidationIssues(failure, { source: 'body' });
            expect(issues).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        pointer: '/name',
                        detail: expect.any(String)
                    })
                ])
            );
            expect(JSON.parse(JSON.stringify(issues))).toEqual(issues);
        });
    });
    it.each([
        [new vendors.VendorNameError('Bad name'), 400, true],
        [new vendors.VendorMetadataError('Bad metadata'), 400, true],
        [new vendors.VendorNotFoundError('Missing vendor'), 404, false],
        [new BudgetAccessError('No access'), 404, false],
        [new BudgetPermissionError('Read only'), 403, false]
    ] as const)('maps %s without losing contextual vendor logging', async (failure, status, logged) => {
        vi.spyOn(vendors, 'updateVendor').mockRejectedValue(failure);
        await withServer(async (url, logger) => {
            const response = await fetch(`${url}/api/vendors/9`, {
                method: 'PATCH',
                headers: { ...auth, 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'Vendor' })
            });
            expect(response.status).toBe(status);
            expect(await response.json()).toEqual({ message: failure.message });
            if (logged) {
                expect(logger.warn).toHaveBeenCalledWith(
                    VendorUpdateValidationRejected,
                    { Reason: failure.message, UserId: 42, VendorId: 9 }
                );
            } else {
                expect(logger.warn).not.toHaveBeenCalled();
            }
        });
    });

    it('keeps unknown errors in the existing server error path', async () => {
        const failure = new Error('Database offline');
        vi.spyOn(vendors, 'updateVendor').mockRejectedValue(failure);
        await withServer(async url => {
            const response = await fetch(`${url}/api/vendors/9`, {
                method: 'PATCH',
                headers: { ...auth, 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'Vendor' })
            });
            expect(response.status).toBe(500);
        });
    });

    it('still authorizes and validates before invoking a bound handler', async () => {
        const update = vi.spyOn(vendors, 'updateVendor');
        await withServer(async url => {
            const anonymous = await fetch(`${url}/api/vendors/9`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: '{}'
            });
            expect(anonymous.status).toBe(401);
            expect(anonymous.headers.get('www-authenticate')).toBe('Bearer');
            const invalid = await fetch(`${url}/api/vendors/9`, {
                method: 'PATCH',
                headers: { ...auth, 'content-type': 'application/json' },
                body: JSON.stringify({ name: '' })
            });
            expect(invalid.status).toBe(400);
            expect(update).not.toHaveBeenCalled();
        });
    });

    it('preserves login error responses and the single-user guard', async () => {
        const login = vi
            .spyOn(users, 'loginUser')
            .mockRejectedValue(
                new users.InvalidCredentialsError('Invalid credentials')
            );
        const request = {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                email: 'person@example.com',
                password: 'dummy-password'
            })
        };
        await withServer(async url => {
            const response = await fetch(`${url}/api/auth/login`, request);
            expect(response.status).toBe(401);
            expect(await response.json()).toEqual({
                message: 'Invalid credentials'
            });
        });
        login.mockClear();
        await withServer(
            async url => {
                const response = await fetch(`${url}/api/auth/login`, request);
                expect(response.status).toBe(401);
                expect(await response.json()).toEqual({
                    message:
                        'Account authentication is disabled in single-user mode.'
                });
                expect(login).not.toHaveBeenCalled();
            },
            { singleUser: { enabled: true, email: 'owner@example.com' } }
        );
    });

    it('preserves created responses and Location headers', async () => {
        const pending = {
            email: 'person@example.com',
            verificationRequired: true,
            message: 'Confirm your email'
        };
        vi.spyOn(users, 'registerUser').mockResolvedValue(pending);
        await withServer(async url => {
            const response = await fetch(`${url}/api/auth/register`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    email: pending.email,
                    password: 'dummy-password',
                    confirmPassword: 'dummy-password',
                    defaultCurrency: 'USD',
                    countryCode: 'US'
                })
            });
            expect(response.status).toBe(201);
            expect(response.headers.get('location')).toBe(
                '/api/auth/email/confirm'
            );
            expect(await response.json()).toEqual(pending);
        });
    });

    it('preserves CSV download headers and declared export failures', async () => {
        const exportCsv = vi
            .spyOn(transactions, 'exportTransactionsCsv')
            .mockResolvedValue({
                csv: 'amount\n12\n',
                fileName: 'transactions.csv'
            });
        await withServer(async url => {
            const response = await fetch(
                `${url}/api/transactions/export.csv?currencies=USD`,
                {
                    headers: auth
                }
            );
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe(
                'text/csv; charset=utf-8'
            );
            expect(response.headers.get('content-disposition')).toContain(
                'transactions.csv'
            );
            expect(await response.text()).toBe('amount\n12\n');
            exportCsv.mockRejectedValue(
                new transactions.TransactionExportError('Invalid period')
            );
            const rejected = await fetch(
                `${url}/api/transactions/export.csv?currencies=USD`,
                {
                    headers: auth
                }
            );
            expect(rejected.status).toBe(400);
            expect(await rejected.json()).toEqual({
                message: 'Invalid period'
            });
        });
    });

    it('keeps public token-gated scan status and progress registrations', async () => {
        const missing = {
            jobId: 'missing-job',
            stage: 'failed' as const,
            scan: null,
            error: 'Scan job was not found.',
            message: 'Scan job was not found.',
            progress: 100
        };
        vi.spyOn(TransactionScanJobs.prototype, 'status').mockResolvedValue(
            missing
        );
        vi.spyOn(TransactionScanJobs.prototype, 'subscribe').mockImplementation(
            async function* () {
                yield missing;
            }
        );
        await withServer(async url => {
            const query = new URLSearchParams({
                jobId: 'missing-job',
                token: 'invalid-progress-token'
            });
            const response = await fetch(
                `${url}/api/transaction-scans/jobs/status?${query}`
            );
            expect(response.status).toBe(200);
            const event = await response.json();
            expect(event).toMatchObject({
                stage: 'failed',
                scan: null,
                error: 'Scan job was not found.'
            });
            const socket = new WebSocket(
                `${url.replace('http:', 'ws:')}/api/transaction-scans/jobs/progress?${query}`
            );
            try {
                const received = await new Promise<string>(
                    (resolve, reject) => {
                        socket.addEventListener(
                            'message',
                            event => resolve(String(event.data)),
                            { once: true }
                        );
                        socket.addEventListener('error', reject, {
                            once: true
                        });
                    }
                );
                expect(JSON.parse(received)).toEqual({
                    type: 'message',
                    data: event
                });
            } finally {
                socket.close();
            }
        });
    });
});
