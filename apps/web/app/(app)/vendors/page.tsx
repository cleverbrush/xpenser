import { VendorsExplorer } from '@/components/vendors-explorer';
import { getApiClient } from '@/lib/api';
import { isDashboardPeriod, parseDateParam } from '@/lib/dashboard-periods';
import { initialDashboardWindowDate } from '@/lib/dashboard-window';
import { vendorAnalyticsVendorLimit } from '@/lib/vendor-analytics';

type VendorsSearchParams = {
    readonly date?: string;
    readonly period?: string;
};

export const dynamic = 'force-dynamic';

export default async function VendorsPage({
    searchParams
}: {
    readonly searchParams: Promise<VendorsSearchParams>;
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
            vendorLimit: vendorAnalyticsVendorLimit,
            period,
            ...(selectedDate ? { date: selectedDate } : {})
        }
    });

    return (
        <VendorsExplorer
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
