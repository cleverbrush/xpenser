import { type NextRequest, NextResponse } from 'next/server';
import { webConfig } from '@/lib/config';
import { InvalidCheckSignOut } from '@/lib/log-templates';
import { loggerFor } from '@/lib/logger';
import { publicAppUrl } from '@/lib/public-url';

export const dynamic = 'force-dynamic';

const authLogger = loggerFor('Auth.js');

function redirectToLogin() {
    return NextResponse.redirect(publicAppUrl('/login'));
}

export async function GET(request: NextRequest) {
    if (webConfig.singleUser?.enabled) {
        return NextResponse.redirect(publicAppUrl('/dashboard'));
    }

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

    const { signOut } = await import('@/auth');
    await signOut({ redirect: false, redirectTo: '/login' });
    return redirectToLogin();
}
