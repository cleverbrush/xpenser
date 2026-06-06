import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { signIn } from '@/auth';
import { expiredSessionPath } from '@/lib/auth-routes';

const passportPkceCookie = 'xpenser_passport_pkce';
const passportRedirectCookie = 'xpenser_passport_redirect';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeRedirect(value: string | undefined, request: NextRequest): string {
    if (!value?.startsWith('/') || value.startsWith('//')) {
        return '/dashboard';
    }
    try {
        const url = new URL(value, request.nextUrl.origin);
        if (url.origin !== request.nextUrl.origin) {
            return '/dashboard';
        }
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return '/dashboard';
    }
}

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get('code');
    const cookieStore = await cookies();
    const codeVerifier = cookieStore.get(passportPkceCookie)?.value;
    const redirectTo = safeRedirect(
        cookieStore.get(passportRedirectCookie)?.value,
        request
    );
    cookieStore.delete(passportPkceCookie);
    cookieStore.delete(passportRedirectCookie);

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
        redirectTo
    });
}
