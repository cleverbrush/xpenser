import { BrandsExplorer } from '@/components/brands-explorer';
import { getApiClient } from '@/lib/api';
import { brandAnalyticsMerchantLimit } from '@/lib/brand-analytics';
import { isDashboardPeriod, parseDateParam } from '@/lib/dashboard-periods';
import { initialDashboardWindowDate } from '@/lib/dashboard-window';

type BrandsSearchParams = {
    readonly date?: string;
    readonly period?: string;
};

export const dynamic = 'force-dynamic';

export default async function BrandsPage({
    searchParams
}: {
    readonly searchParams: Promise<BrandsSearchParams>;
}) {
    const params = await searchParams;
    const period = isDashboardPeriod(params.period) ? params.period : 'day';
    const client = await getApiClient();
    const me = await client.auth.me();
    const selectedDate = parseDateParam(params.date, me.timezone);
    const anchorDate = selectedDate ?? new Date();
    const window = await client.dashboard.window({
        query: {
            after: 2,
            before: 2,
            merchantLimit: brandAnalyticsMerchantLimit,
            period,
            ...(selectedDate ? { date: selectedDate } : {})
        }
    });

    return (
        <BrandsExplorer
            initialDate={initialDashboardWindowDate(
                window,
                anchorDate,
                me.timezone
            )}
            initialPeriod={period}
            initialWindow={window}
            timezone={me.timezone}
        />
    );
}
