import { type NextRequest, NextResponse } from 'next/server';
import { signIn } from '@/auth';
import { expiredSessionPath } from '@/lib/auth-routes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get('code');

    if (!code) {
        return NextResponse.redirect(
            new URL(
                `${expiredSessionPath}?error=MissingPassportCode`,
                request.url
            )
        );
    }

    return signIn('passport-code', {
        code,
        redirectTo: '/dashboard'
    });
}
