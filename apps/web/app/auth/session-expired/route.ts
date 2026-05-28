import { type NextRequest, NextResponse } from 'next/server';
import { signOut } from '@/auth';
import { InvalidCheckSignOut } from '@/lib/log-templates';
import { loggerFor } from '@/lib/logger';
import { publicAppUrl } from '@/lib/public-url';

export const dynamic = 'force-dynamic';

const authLogger = loggerFor('Auth.js');

function redirectToLogin() {
    return NextResponse.redirect(publicAppUrl('/login'));
}

export async function GET(request: NextRequest) {
    const authError = request.nextUrl.searchParams.get('error');
    if (authError && authError !== 'InvalidCheck') {
        return redirectToLogin();
    }

    if (authError === 'InvalidCheck') {
        authLogger.warn(InvalidCheckSignOut, {
            AuthErrorType: 'InvalidCheck',
            Url: request.url
        });
    }

    await signOut({ redirect: false, redirectTo: '/login' });
    return redirectToLogin();
}
