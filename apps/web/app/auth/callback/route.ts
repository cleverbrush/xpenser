import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { signIn } from '@/auth';
import { expiredSessionPath } from '@/lib/auth-routes';

const passportPkceCookie = 'xpenser_passport_pkce';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get('code');
    const cookieStore = await cookies();
    const codeVerifier = cookieStore.get(passportPkceCookie)?.value;
    cookieStore.delete(passportPkceCookie);

    if (!code) {
        return NextResponse.redirect(
            new URL(
                `${expiredSessionPath}?error=MissingPassportCode`,
                request.url
            )
        );
    }
    if (!codeVerifier) {
        return NextResponse.redirect(
            new URL(
                `${expiredSessionPath}?error=MissingPassportVerifier`,
                request.url
            )
        );
    }

    return signIn('passport-code', {
        code,
        codeVerifier,
        redirectTo: '/dashboard'
    });
}
