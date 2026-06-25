import { type NextRequest, NextResponse } from 'next/server';
import { expiredSessionPath } from '@/lib/auth-routes';
import { webConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    if (webConfig.singleUser?.enabled) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
        return NextResponse.redirect(
            new URL(
                `${expiredSessionPath}?error=MissingEmailConfirmationToken`,
                request.url
            )
        );
    }

    const { signIn } = await import('@/auth');
    return signIn('email-confirmation-token', {
        token,
        redirectTo: '/dashboard'
    });
}
