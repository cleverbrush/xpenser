import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';
import { hashPassword } from '../security/password.js';
import {
    confirmEmail,
    createEmailConfirmationToken,
    EmailNotVerifiedError,
    hashEmailConfirmationToken,
    InvalidGoogleIdentityError,
    InvalidPassportIdentityError,
    issueUserToken,
    loginUser,
    PasswordMismatchError,
    resolveGoogleUser,
    transactionCurrenciesByRecentPopularity,
    verifyWebApiServiceSecret
} from './users.js';

const config = {
    jwt: {
        secret: 'x'.repeat(32),
        expiresInSeconds: 120
    },
    web: {
        apiServiceSecret: 'web-service-secret-minimum-32-chars'
    },
    emailConfirmation: {
        tokenTtlSeconds: 86_400
    }
} as Config;

function mockDbWithUser(): AppDb {
    return {
        users: {
            find: vi.fn(async () => ({
                id: 12,
                email: 'jane@example.com',
                emailVerified: true,
                authProvider: 'local',
                role: 'user',
                defaultCurrency: 'USD',
                countryCode: 'US',
                timezone: 'UTC'
            }))
        },
        categories: {
            where: vi.fn(() => ({
                limit: vi.fn(async () => [])
            }))
        }
    } as unknown as AppDb;
}

afterEach(() => {
    vi.useRealTimers();
});

describe('user domain errors', () => {
    it('uses a specific error for password mismatch', () => {
        expect(new PasswordMismatchError('x')).toBeInstanceOf(Error);
    });

    it('uses a specific error for invalid Passport identities', () => {
        expect(new InvalidPassportIdentityError('x')).toBeInstanceOf(Error);
    });
});

describe('user token issuance', () => {
    it('returns an explicit API token expiry', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'));

        const response = await issueUserToken(mockDbWithUser(), config, 12);

        expect(response?.expiresAt).toEqual(
            new Date('2026-06-01T00:02:00.000Z')
        );
        expect(response?.token).toEqual(expect.any(String));
    });

    it('does not issue API tokens for unverified local users', async () => {
        const response = await issueUserToken(
            {
                users: {
                    find: vi.fn(async () => ({
                        id: 12,
                        email: 'jane@example.com',
                        emailVerified: false,
                        authProvider: 'local',
                        role: 'user',
                        defaultCurrency: 'USD',
                        countryCode: 'US',
                        timezone: 'UTC'
                    }))
                }
            } as unknown as AppDb,
            config,
            12
        );

        expect(response).toBeUndefined();
    });

    it('compares web service secrets without accepting partial values', () => {
        expect(
            verifyWebApiServiceSecret(
                config,
                'web-service-secret-minimum-32-chars'
            )
        ).toBe(true);
        expect(verifyWebApiServiceSecret(config, undefined)).toBe(false);
        expect(verifyWebApiServiceSecret(config, 'web-service-secret')).toBe(
            false
        );
        expect(
            verifyWebApiServiceSecret(
                config,
                'web-service-secret-minimum-32-charx'
            )
        ).toBe(false);
    });
});

describe('email confirmation', () => {
    it('creates opaque confirmation tokens with hashed storage values', () => {
        const issuedAt = new Date('2026-06-01T00:00:00.000Z');
        const confirmation = createEmailConfirmationToken(config, issuedAt);

        expect(confirmation.token).toEqual(expect.any(String));
        expect(confirmation.tokenHash).toBe(
            hashEmailConfirmationToken(confirmation.token)
        );
        expect(confirmation.tokenHash).not.toBe(confirmation.token);
        expect(confirmation.expiresAt).toEqual(
            new Date('2026-06-02T00:00:00.000Z')
        );
    });

    it('rejects password login for unverified local users', async () => {
        const passwordHash = await hashPassword('correct horse battery staple');
        const db = {
            users: {
                projected: vi.fn(() => ({
                    where: vi.fn(() => ({
                        first: vi.fn(async () => ({
                            id: 12,
                            email: 'jane@example.com',
                            passwordHash,
                            emailVerified: false,
                            authProvider: 'local',
                            role: 'user',
                            defaultCurrency: 'USD',
                            countryCode: 'US',
                            timezone: 'UTC'
                        }))
                    }))
                }))
            }
        } as unknown as AppDb;

        await expect(
            loginUser(
                db,
                config,
                'jane@example.com',
                'correct horse battery staple'
            )
        ).rejects.toBeInstanceOf(EmailNotVerifiedError);
    });

    it('confirms a valid email token and clears it before issuing a token', async () => {
        const token = 'confirmation-token';
        const user = {
            id: 12,
            email: 'jane@example.com',
            passwordHash: 'hash',
            emailVerified: false,
            emailVerificationTokenHash: hashEmailConfirmationToken(token),
            emailVerificationExpiresAt: new Date('2026-06-02T00:00:00.000Z'),
            authProvider: 'local',
            role: 'user',
            defaultCurrency: 'USD',
            countryCode: 'US',
            timezone: 'UTC'
        };
        let updateValues: object | undefined;

        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'));

        const db = {
            users: {
                projected: vi.fn(() => ({
                    where: vi.fn(() => ({
                        first: vi.fn(async () => user)
                    }))
                })),
                where: vi.fn(() => ({
                    update: vi.fn(async values => {
                        updateValues = values;
                    })
                })),
                find: vi.fn(async () => ({
                    ...user,
                    emailVerified: true,
                    emailVerificationTokenHash: null,
                    emailVerificationExpiresAt: null
                }))
            },
            categories: {
                where: vi.fn(() => ({
                    limit: vi.fn(async () => [])
                }))
            }
        } as unknown as AppDb;

        const response = await confirmEmail(db, config, token);

        expect(response.user.email).toBe('jane@example.com');
        expect(updateValues).toMatchObject({
            emailVerified: true,
            emailVerificationTokenHash: null,
            emailVerificationExpiresAt: null
        });
    });
});

describe('Google identity resolution', () => {
    function mockGoogleDb({
        existingIdentity,
        existingUserIdentity,
        linkedUser,
        userByEmail
    }: {
        readonly existingIdentity?: object;
        readonly existingUserIdentity?: object;
        readonly linkedUser?: object;
        readonly userByEmail?: object;
    }): { db: AppDb; insertIdentity: ReturnType<typeof vi.fn> } {
        const insertedUser = {
            id: 12,
            email: 'jane@example.com',
            role: 'user',
            authProvider: 'google'
        };
        const insertIdentity = vi.fn();
        const trx = {
            externalIdentities: {
                where: vi
                    .fn()
                    .mockReturnValueOnce({
                        where: vi.fn(() => ({
                            first: vi.fn(async () => existingIdentity)
                        }))
                    })
                    .mockReturnValueOnce({
                        where: vi.fn(() => ({
                            first: vi.fn(async () => existingUserIdentity)
                        }))
                    }),
                insert: insertIdentity
            },
            users: {
                find: vi.fn(async () => linkedUser),
                where: vi.fn(() => ({
                    first: vi.fn(async () => userByEmail)
                })),
                insert: vi.fn(async () => insertedUser)
            }
        };

        return {
            db: {
                transaction: async <T>(callback: (db: typeof trx) => T) =>
                    callback(trx)
            } as unknown as AppDb,
            insertIdentity
        };
    }

    it('creates a Google user and external identity for a new verified identity', async () => {
        const { db, insertIdentity } = mockGoogleDb({});

        const response = await resolveGoogleUser(db, {
            providerSubject: 'google-subject',
            email: 'jane@example.com',
            emailVerified: true
        });

        expect(response).toEqual({
            service_user_id: '12',
            roles: ['user']
        });
        expect(insertIdentity).toHaveBeenCalledWith({
            provider: 'google',
            providerSubject: 'google-subject',
            userId: 12,
            email: 'jane@example.com'
        });
    });

    it('reuses an existing linked Google identity', async () => {
        const { db, insertIdentity } = mockGoogleDb({
            existingIdentity: { userId: 15 },
            linkedUser: {
                id: 15,
                role: 'admin'
            }
        });

        await expect(
            resolveGoogleUser(db, {
                providerSubject: 'google-subject',
                email: 'jane@example.com',
                emailVerified: true
            })
        ).resolves.toEqual({
            service_user_id: '15',
            roles: ['admin']
        });
        expect(insertIdentity).not.toHaveBeenCalled();
    });

    it('rejects unverified Google emails', async () => {
        await expect(
            resolveGoogleUser({} as AppDb, {
                providerSubject: 'google-subject',
                email: 'jane@example.com',
                emailVerified: false
            })
        ).rejects.toBeInstanceOf(InvalidGoogleIdentityError);
    });

    it('rejects local accounts with the same email', async () => {
        const { db } = mockGoogleDb({
            userByEmail: {
                id: 12,
                email: 'jane@example.com',
                authProvider: 'local'
            }
        });

        await expect(
            resolveGoogleUser(db, {
                providerSubject: 'google-subject',
                email: 'jane@example.com',
                emailVerified: true
            })
        ).rejects.toBeInstanceOf(InvalidGoogleIdentityError);
    });
});

describe('transaction currency ordering', () => {
    it('sorts configured currencies by recent transaction popularity', () => {
        expect(
            transactionCurrenciesByRecentPopularity(
                ['USD', 'EUR', 'GBP'],
                [{ currency: 'EUR' }, { currency: 'GBP' }, { currency: 'EUR' }]
            )
        ).toEqual(['EUR', 'GBP', 'USD']);
    });

    it('breaks popularity ties by the currency used latest', () => {
        expect(
            transactionCurrenciesByRecentPopularity(
                ['USD', 'EUR', 'GBP'],
                [
                    { currency: 'GBP' },
                    { currency: 'EUR' },
                    { currency: 'EUR' },
                    { currency: 'GBP' }
                ]
            )
        ).toEqual(['GBP', 'EUR', 'USD']);
    });

    it('includes recent currencies outside primary and favorites', () => {
        expect(
            transactionCurrenciesByRecentPopularity(
                ['USD', 'EUR'],
                [{ currency: 'UAH' }, { currency: 'USD' }, { currency: 'UAH' }]
            )
        ).toEqual(['UAH', 'USD', 'EUR']);
    });

    it('falls back to original configured order without recent transactions', () => {
        expect(
            transactionCurrenciesByRecentPopularity(['USD', 'EUR'], [])
        ).toEqual(['USD', 'EUR']);
    });
});
