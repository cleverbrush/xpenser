import { createXpenserClient } from '@xpenser/client';
import type { CashFlowForecastJobResponse } from '@xpenser/contracts';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { webConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

type ForecastJobRouteResponse =
    | { readonly error: string; readonly job?: undefined }
    | {
          readonly error?: undefined;
          readonly job: CashFlowForecastJobResponse;
      };

type ForecastJobRequestBody = {
    readonly date?: string;
    readonly force?: boolean;
};

function apiErrorStatus(err: unknown): number | undefined {
    return typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof err.status === 'number'
        ? err.status
        : undefined;
}

function apiErrorMessage(err: unknown): string | undefined {
    const body =
        typeof err === 'object' && err !== null && 'body' in err
            ? (err as { readonly body?: unknown }).body
            : undefined;
    return typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof body.message === 'string'
        ? body.message
        : undefined;
}

function errorResponse(message: string, status: number) {
    return NextResponse.json<ForecastJobRouteResponse>(
        { error: message },
        { status }
    );
}

function requestBody(value: unknown): ForecastJobRequestBody | undefined {
    if (typeof value !== 'object' || value === null) {
        return {};
    }

    const record = value as Record<string, unknown>;
    if (record.date !== undefined && typeof record.date !== 'string') {
        return undefined;
    }
    if (record.force !== undefined && typeof record.force !== 'boolean') {
        return undefined;
    }

    return {
        date: record.date,
        force: record.force
    };
}

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.apiToken) {
        return errorResponse('Session expired.', 401);
    }

    let body: ForecastJobRequestBody | undefined;
    try {
        body = requestBody(await request.json());
    } catch {
        body = {};
    }

    if (!body) {
        return errorResponse('Invalid forecast request.', 400);
    }

    const client = createXpenserClient({
        baseUrl: webConfig.apiBaseUrl,
        getToken: () => session.apiToken,
        retryOnTimeout: false
    });

    try {
        const job = await client.stats.cashFlowForecastJob({
            body: {
                date: body.date ? new Date(body.date) : undefined,
                force: body.force ?? false
            }
        });
        return NextResponse.json<ForecastJobRouteResponse>({ job });
    } catch (err) {
        const status = apiErrorStatus(err);
        if (status === 400) {
            return errorResponse(
                apiErrorMessage(err) ?? 'Could not start forecast generation.',
                400
            );
        }
        if (status === 401) {
            return errorResponse('Session expired.', 401);
        }
        return errorResponse('Could not start forecast generation.', 500);
    }
}
