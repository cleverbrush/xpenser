import Link from 'next/link';
import { CashFlowForecastExplorer } from '@/components/cash-flow-forecast-explorer';
import { getApiClient } from '@/lib/api';
import { parseDateParam } from '@/lib/dashboard-periods';

type ForecastSearchParams = {
    readonly date?: string;
};

export const dynamic = 'force-dynamic';

export default async function CashFlowForecastPage({
    searchParams
}: {
    readonly searchParams: Promise<ForecastSearchParams>;
}) {
    const params = await searchParams;
    const client = await getApiClient({
        retryOnTimeout: false,
        timeoutMs: 30_000
    });
    const me = await client.auth.me();
    const date = parseDateParam(params.date, me.timezone);
    const forecast = await client.stats.cashFlowForecast({
        query: date ? { date } : {}
    });

    return (
        <div className="flex flex-col gap-4">
            <Link
                className="w-fit text-sm text-muted-foreground transition-colors hover:text-foreground"
                href="/stats"
            >
                Back to reports
            </Link>
            <CashFlowForecastExplorer
                forecast={forecast}
                timezone={me.timezone}
            />
        </div>
    );
}
