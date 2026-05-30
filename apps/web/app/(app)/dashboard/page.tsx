import type { DashboardWindowResponse } from '@xpenser/contracts';
import { redirect } from 'next/navigation';
import { DashboardExplorer } from '@/components/dashboard-explorer';
import { getApiClient } from '@/lib/api';
import {
    dateParam,
    isDashboardPeriod,
    parseDateParam
} from '@/lib/dashboard-periods';

type DashboardSearchParams = {
    readonly date?: string;
    readonly period?: string;
};

function initialDashboardDate(
    window: DashboardWindowResponse,
    anchorDate: Date,
    timezone: string
): string {
    return (
        window.items.find(item => {
            const from = new Date(item.summary.from);
            const to = new Date(item.summary.to);
            return anchorDate >= from && anchorDate <= to;
        })?.date ?? dateParam(anchorDate, timezone)
    );
}

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
    const [categories, currencies, window] = await Promise.all([
        client.categories.list({
            query: { sort: 'recent-transaction-count' }
        }),
        client.currencies.list(),
        client.dashboard.window({
            query: {
                after: 2,
                before: 2,
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
            initialDate={initialDashboardDate(window, anchorDate, me.timezone)}
            initialPeriod={period}
            initialWindow={window}
            timezone={me.timezone}
            transactionCurrencies={me.transactionCurrencies}
        />
    );
}
