import { redirect } from 'next/navigation';
import { DashboardExplorer } from '@/components/dashboard-explorer';
import { getApiClient } from '@/lib/api';
import { isDashboardPeriod, parseDateParam } from '@/lib/dashboard-periods';
import { initialDashboardWindowDate } from '@/lib/dashboard-window';

type DashboardSearchParams = {
    readonly date?: string;
    readonly period?: string;
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
    searchParams
}: {
    readonly searchParams: Promise<DashboardSearchParams>;
}) {
    const params = await searchParams;
    const period = isDashboardPeriod(params.period) ? params.period : 'day';
    const client = await getApiClient();
    const me = await client.auth.me();
    const selectedDate = parseDateParam(params.date, me.timezone);
    const anchorDate = selectedDate ?? new Date();
    const [categories, currencies, vendors, window] = await Promise.all([
        client.categories.list({
            query: { activeOnly: true, sort: 'recent-transaction-count' }
        }),
        client.currencies.list(),
        client.vendors.list({ query: { limit: 100 } }),
        client.dashboard.window({
            query: {
                after: 2,
                before: 2,
                vendorLimit: 0,
                period,
                ...(selectedDate ? { date: selectedDate } : {})
            }
        })
    ]);

    if (!me.hasCategories) {
        redirect('/setup/categories');
    }

    return (
        <DashboardExplorer
            categories={categories}
            currencies={currencies}
            defaultCurrency={me.defaultCurrency}
            initialDate={initialDashboardWindowDate(
                window,
                anchorDate,
                me.timezone
            )}
            initialPeriod={period}
            initialWindow={window}
            vendors={vendors}
            timezone={me.timezone}
            transactionCurrencies={me.transactionCurrencies}
        />
    );
}
