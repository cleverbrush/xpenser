import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/api';
import { selectedBudgetIdFromCookie } from '@/lib/budgets';
import { webConfig } from '@/lib/config';
import { buildTransactionListQuery } from '@/lib/transaction-query';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function exportApiQuery(
    params: URLSearchParams,
    timeZone: string,
    budgetId?: number
): URLSearchParams {
    const query = buildTransactionListQuery(params, {}, timeZone);
    const exportParams = new URLSearchParams();
    if (budgetId) {
        exportParams.set('budgetId', String(budgetId));
    }
    const currencies = params.get('currencies');
    if (currencies) {
        exportParams.set('currencies', currencies);
    }
    if (query.search) {
        exportParams.set('search', query.search);
    }
    if (query.type) {
        exportParams.set('type', query.type);
    }
    if (query.categoryId) {
        exportParams.set('categoryId', String(query.categoryId));
    }
    if (query.parentCategoryId) {
        exportParams.set('parentCategoryId', String(query.parentCategoryId));
    }
    if (query.vendorId) {
        exportParams.set('vendorId', String(query.vendorId));
    }
    if (query.tagIds) {
        exportParams.set('tagIds', query.tagIds);
    }
    if (query.untagged) {
        exportParams.set('untagged', 'true');
    }
    if (query.from) {
        exportParams.set('from', query.from.toISOString());
    }
    if (query.to) {
        exportParams.set('to', query.to.toISOString());
    }
    if (query.direction) {
        exportParams.set('direction', query.direction);
    }
    return exportParams;
}

export async function GET(request: NextRequest) {
    const session = await getCurrentSession();
    if (!session?.apiToken) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const budgetId = await selectedBudgetIdFromCookie();
    const query = exportApiQuery(
        request.nextUrl.searchParams,
        session.user.timezone,
        budgetId
    );
    if (!query.get('currencies')) {
        return NextResponse.json(
            { message: 'Select at least one currency to export.' },
            { status: 400 }
        );
    }

    const url = new URL('/api/transactions/export.csv', webConfig.apiBaseUrl);
    url.search = query.toString();
    const response = await fetch(url, {
        cache: 'no-store',
        headers: {
            Authorization: `Bearer ${session.apiToken}`
        }
    });
    const body = await response.text();

    if (!response.ok) {
        return new NextResponse(body, {
            status: response.status,
            headers: {
                'Content-Type':
                    response.headers.get('content-type') ??
                    'application/json; charset=utf-8'
            }
        });
    }

    return new NextResponse(body, {
        status: response.status,
        headers: {
            'Cache-Control': 'private, no-store',
            'Content-Disposition':
                response.headers.get('content-disposition') ??
                'attachment; filename="xpenser-transactions.csv"',
            'Content-Length': String(Buffer.byteLength(body)),
            'Content-Type':
                response.headers.get('content-type') ??
                'text/csv; charset=utf-8'
        }
    });
}
