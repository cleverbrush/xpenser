import { createXpenserClient } from '@xpenser/client';
import type { StatsTagReportQuery } from '@xpenser/contracts';
import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/api';
import { selectedBudgetIdFromCookie } from '@/lib/budgets';
import { webConfig } from '@/lib/config';
import { isDashboardPeriod, parseDateParam } from '@/lib/dashboard-periods';

export const dynamic = 'force-dynamic';

function isUnauthorizedApiError(err: unknown): boolean {
    return (
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        err.status === 401
    );
}

function tagReportQuery(
    params: URLSearchParams,
    timezone: string
): StatsTagReportQuery {
    const periodParam = params.get('period') ?? undefined;
    const dateParam = params.get('date') ?? undefined;
    const tagParam = params.get('tag') ?? undefined;
    const tagId = tagParam ? Number(tagParam) : Number.NaN;
    const date = dateParam ? parseDateParam(dateParam, timezone) : undefined;

    return {
        period: isDashboardPeriod(periodParam) ? periodParam : 'day',
        ...(date ? { date } : undefined),
        ...(tagParam === 'untagged'
            ? { tag: 'untagged' as const }
            : Number.isInteger(tagId) && tagId > 0
              ? { tag: tagId }
              : undefined)
    };
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
        const budgetId = await selectedBudgetIdFromCookie();
        return NextResponse.json(
            await client.stats.tags({
                query: {
                    ...tagReportQuery(
                        request.nextUrl.searchParams,
                        session.user.timezone
                    ),
                    ...(budgetId ? { budgetId } : {})
                }
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
