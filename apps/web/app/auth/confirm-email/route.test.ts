import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    class TestAuthError extends Error {
        readonly type: string;

        constructor(type: string) {
            super(type);
            this.type = type;
        }
    }

    return {
        AuthError: TestAuthError,
        signIn: vi.fn()
    };
});

vi.mock('next-auth', () => ({
    AuthError: mocks.AuthError
}));

vi.mock('@/auth', () => ({
    signIn: mocks.signIn
}));

vi.mock('@/lib/config', () => ({
    webConfig: { singleUser: { enabled: false } }
}));

vi.mock('@/lib/public-url', () => ({
    publicAppUrl: (path: string) => new URL(path, 'https://app.example.test')
}));

import { NextRequest } from 'next/server';
import { GET } from './route';

function confirmationRequest(search = '') {
    return new NextRequest(`https://0.0.0.0:3000/auth/confirm-email${search}`);
}

describe('email confirmation route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('redirects a missing token to the login recovery panel', async () => {
        const response = await GET(confirmationRequest());

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://app.example.test/login?confirmation=invalid-or-expired'
        );
        expect(mocks.signIn).not.toHaveBeenCalled();
    });

    it('redirects an expected credentials rejection to recovery', async () => {
        mocks.signIn.mockRejectedValue(
            new mocks.AuthError('CredentialsSignin')
        );

        const response = await GET(confirmationRequest('?token=invalid-token'));

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://app.example.test/login?confirmation=invalid-or-expired'
        );
    });

    it('rethrows unexpected authentication failures', async () => {
        const failure = new mocks.AuthError('CallbackRouteError');
        mocks.signIn.mockRejectedValue(failure);

        await expect(
            GET(confirmationRequest('?token=valid-token'))
        ).rejects.toBe(failure);
    });

    it('rethrows non-authentication failures', async () => {
        const failure = new Error('network unavailable');
        mocks.signIn.mockRejectedValue(failure);

        await expect(
            GET(confirmationRequest('?token=valid-token'))
        ).rejects.toBe(failure);
    });

    it('returns the successful sign-in response unchanged', async () => {
        const success = new Response(null, {
            headers: { location: 'https://app.example.test/dashboard' },
            status: 302
        });
        mocks.signIn.mockResolvedValue(success);

        const response = await GET(confirmationRequest('?token=valid-token'));

        expect(response).toBe(success);
        expect(mocks.signIn).toHaveBeenCalledWith('email-confirmation-token', {
            redirectTo: '/dashboard',
            token: 'valid-token'
        });
    });
});
