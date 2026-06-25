import { type NextRequest, NextResponse } from 'next/server';
import { webConfig } from '@/lib/config';
import { publicAppUrl } from '@/lib/public-url';

function redirectToDashboard() {
    return NextResponse.redirect(publicAppUrl('/dashboard'));
}

export async function GET(request: NextRequest) {
    if (webConfig.singleUser?.enabled) {
        return redirectToDashboard();
    }

    const { handlers } = await import('@/auth');
    return handlers.GET(request);
}

export async function POST(request: NextRequest) {
    if (webConfig.singleUser?.enabled) {
        return redirectToDashboard();
    }

    const { handlers } = await import('@/auth');
    return handlers.POST(request);
}
