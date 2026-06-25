import { createXpenserClient } from '@xpenser/client';
import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/api';
import { webConfig } from '@/lib/config';
import { periodWindowQuery } from '@/lib/period-window-query';

export const dynamic = 'force-dynamic';

function isUnauthorizedApiError(err: unknown): boolean {
    return (
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        err.status === 401
    );
}

export async function GET(request: NextRequest) {
    const session = await getCurrentSession();
    if (!session?.apiToken) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const client = createXpenserClient({
        baseUrl: webConfig.apiBaseUrl,
        getToken: () => session.apiToken
    });

    try {
        return NextResponse.json(
            await client.stats.window({
                query: periodWindowQuery(
                    request.nextUrl.searchParams,
                    session.user.timezone
                )
            })
        );
    } catch (err) {
        if (isUnauthorizedApiError(err)) {
            return NextResponse.json(
                { message: 'Session expired.' },
                { status: 401 }
            );
        }
        throw err;
    }
}
