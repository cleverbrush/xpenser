import { createXpenserClient } from '@xpenser/client';
import { NextResponse } from 'next/server';
import { webConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const connectionError = 'Could not connect to scan progress. Try again.';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');
    const token = url.searchParams.get('token');

    if (!jobId || !token) {
        return NextResponse.json({ error: connectionError }, { status: 400 });
    }

    const client = createXpenserClient({
        baseUrl: webConfig.apiBaseUrl,
        retryOnTimeout: false
    });

    return NextResponse.json(
        await client.transactionScans.status({
            query: { jobId, token }
        })
    );
}
