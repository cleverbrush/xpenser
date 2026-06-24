import { createXpenserClient } from '@xpenser/client';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { webConfig } from '@/lib/config';
import {
    buildTransactionListQuery,
    transactionHasMore
} from '@/lib/transaction-query';

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
    const session = await auth();
    if (!session?.apiToken) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const client = createXpenserClient({
        baseUrl: webConfig.apiBaseUrl,
        getToken: () => session.apiToken
    });
    try {
        const transactions = await client.transactions.list({
            query: buildTransactionListQuery(
                request.nextUrl.searchParams,
                {},
                session.user.timezone
            )
        });

        return NextResponse.json({
            ...transactions,
            hasMore: transactionHasMore(transactions)
        });
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
