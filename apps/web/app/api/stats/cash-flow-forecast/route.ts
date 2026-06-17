import type { CashFlowForecastResponse } from '@xpenser/contracts';
import { NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api';

export const dynamic = 'force-dynamic';

type ForecastRouteResponse =
    | { readonly error: string; readonly forecast?: undefined }
    | {
          readonly error?: undefined;
          readonly forecast: CashFlowForecastResponse;
      };

function errorResponse(message: string, status: number) {
    return NextResponse.json<ForecastRouteResponse>(
        { error: message },
        { status }
    );
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const parsedDate = date ? new Date(date) : undefined;
    if (date && Number.isNaN(parsedDate?.getTime())) {
        return errorResponse('Invalid forecast date.', 400);
    }

    try {
        const client = await getApiClient({
            retryOnTimeout: false,
            timeoutMs: 30_000
        });
        const forecast = await client.stats.cashFlowForecast({
            query: parsedDate ? { date: parsedDate } : {}
        });
        return NextResponse.json<ForecastRouteResponse>({ forecast });
    } catch {
        return errorResponse('Could not load forecast.', 500);
    }
}
