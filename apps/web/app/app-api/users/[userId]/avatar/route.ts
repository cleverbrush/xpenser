import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/api';
import { webConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AvatarRouteContext = {
    readonly params:
        | { readonly userId: string }
        | Promise<{ readonly userId: string }>;
};

export async function GET(_request: NextRequest, context: AvatarRouteContext) {
    const [{ userId }, session] = await Promise.all([
        Promise.resolve(context.params),
        getCurrentSession()
    ]);
    const id = Number(userId);
    if (!session?.apiToken || !Number.isSafeInteger(id) || id <= 0) {
        return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const upstream = await fetch(
        new URL(`/api/users/${id}/avatar`, webConfig.apiBaseUrl),
        {
            headers: {
                Authorization: `Bearer ${session.apiToken}`
            }
        }
    );
    if (!upstream.ok) {
        return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const headers = new Headers(upstream.headers);
    headers.delete('content-encoding');
    headers.delete('transfer-encoding');
    return new NextResponse(upstream.body, {
        status: upstream.status,
        headers
    });
}
