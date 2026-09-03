import { type NextRequest, NextResponse } from 'next/server';
import { AuthError } from 'next-auth';
import { webConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function invalidConfirmationRedirect(request: NextRequest) {
    return NextResponse.redirect(
        new URL('/login?confirmation=invalid-or-expired', request.url)
    );
}

export async function GET(request: NextRequest) {
    if (webConfig.singleUser?.enabled) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
        return invalidConfirmationRedirect(request);
    }

    const { signIn } = await import('@/auth');
    try {
        return await signIn('email-confirmation-token', {
            token,
            redirectTo: '/dashboard'
        });
    } catch (error) {
        if (error instanceof AuthError && error.type === 'CredentialsSignin') {
            return invalidConfirmationRedirect(request);
        }
        throw error;
    }
}
