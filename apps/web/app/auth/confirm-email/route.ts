import { type NextRequest, NextResponse } from 'next/server';
import { AuthError } from 'next-auth';
import { webConfig } from '@/lib/config';
import { publicAppUrl } from '@/lib/public-url';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function invalidConfirmationRedirect() {
    return NextResponse.redirect(
        publicAppUrl('/login?confirmation=invalid-or-expired')
    );
}

export async function GET(request: NextRequest) {
    if (webConfig.singleUser?.enabled) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
        return invalidConfirmationRedirect();
    }

    const { signIn } = await import('@/auth');
    try {
        return await signIn('email-confirmation-token', {
            token,
            redirectTo: '/dashboard'
        });
    } catch (error) {
        if (error instanceof AuthError && error.type === 'CredentialsSignin') {
            return invalidConfirmationRedirect();
        }
        throw error;
    }
}
