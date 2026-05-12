import { type NextRequest, NextResponse } from 'next/server';
import { signOut } from '@/auth';
import { loggerFor } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const authLogger = loggerFor('Auth.js');

function redirectToLogin(request: NextRequest) {
    return NextResponse.redirect(new URL('/login', request.url));
}

export async function GET(request: NextRequest) {
    const authError = request.nextUrl.searchParams.get('error');
    if (authError && authError !== 'InvalidCheck') {
        return redirectToLogin(request);
    }

    if (authError === 'InvalidCheck') {
        authLogger.warn(
            'Signing out after Auth.js InvalidCheck and redirecting to login',
            {
                AuthErrorType: 'InvalidCheck',
                Url: request.url
            }
        );
    }

    await signOut({ redirectTo: '/login' });
}
