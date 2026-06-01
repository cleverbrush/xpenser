import { type NextRequest, NextResponse } from 'next/server';
import { signIn } from '@/auth';
import { expiredSessionPath } from '@/lib/auth-routes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
        return NextResponse.redirect(
            new URL(
                `${expiredSessionPath}?error=MissingEmailConfirmationToken`,
                request.url
            )
        );
    }

    return signIn('email-confirmation-token', {
        token,
        redirectTo: '/dashboard'
    });
}
