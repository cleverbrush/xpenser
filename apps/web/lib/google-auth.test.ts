import { describe, expect, it } from 'vitest';
import {
    googleSignInBodyFromAuthProfile,
    resolveGoogleSignInProvider
} from './google-auth';

describe('Google auth helpers', () => {
    it('prefers direct Google auth in auto mode when Auth.js credentials exist', () => {
        expect(
            resolveGoogleSignInProvider({
                mode: 'auto',
                googleClientId: 'google-id',
                googleClientSecret: 'google-secret',
                passportBaseUrl: 'https://auth.example.com',
                passportProject: 'xpenser',
                passportEnvironment: 'production'
            })
        ).toBe('direct');
    });

    it('falls back to Passport in auto mode when only Passport is configured', () => {
        expect(
            resolveGoogleSignInProvider({
                mode: 'auto',
                passportBaseUrl: 'https://auth.example.com',
                passportProject: 'xpenser',
                passportEnvironment: 'production'
            })
        ).toBe('passport');
    });

    it('disables Google sign-in in auto mode without complete auth config', () => {
        expect(
            resolveGoogleSignInProvider({
                mode: 'auto',
                googleClientId: 'google-id'
            })
        ).toBe('disabled');
    });

    it('rejects incomplete explicit direct and Passport modes', () => {
        expect(() =>
            resolveGoogleSignInProvider({
                mode: 'direct',
                googleClientId: 'google-id'
            })
        ).toThrow('AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET');

        expect(() =>
            resolveGoogleSignInProvider({
                mode: 'passport',
                passportBaseUrl: 'https://auth.example.com'
            })
        ).toThrow('PASSPORT_BASE_URL');
    });

    it('maps Auth.js Google profile values to the API body', () => {
        expect(
            googleSignInBodyFromAuthProfile(
                { providerAccountId: 'fallback-subject' },
                {
                    sub: 'google-subject',
                    email: ' jane@example.com ',
                    email_verified: true,
                    name: 'Jane Doe',
                    picture: 'https://example.com/avatar.png'
                }
            )
        ).toEqual({
            providerSubject: 'google-subject',
            email: 'jane@example.com',
            emailVerified: true,
            name: 'Jane Doe',
            avatarUrl: 'https://example.com/avatar.png'
        });
    });

    it('uses the account subject when the profile omits sub', () => {
        expect(
            googleSignInBodyFromAuthProfile(
                { providerAccountId: 'account-subject' },
                {
                    email: 'jane@example.com',
                    email_verified: 'true'
                }
            )
        ).toMatchObject({
            providerSubject: 'account-subject',
            emailVerified: true
        });
    });
});
