import type { StatsWindowResponse } from '@xpenser/contracts';
import { StatsExplorer } from '@/components/stats-explorer';
import { getApiClient } from '@/lib/api';
import {
    dateParam,
    isDashboardPeriod,
    parseDateParam
} from '@/lib/dashboard-periods';

type StatsSearchParams = {
    readonly date?: string;
    readonly period?: string;
};

function initialStatsDate(
    window: StatsWindowResponse,
    anchorDate: Date,
    timezone: string
): string {
    return (
        window.items.find(item => {
            const from = new Date(item.overview.from);
            const to = new Date(item.overview.to);
            return anchorDate >= from && anchorDate <= to;
        })?.date ?? dateParam(anchorDate, timezone)
    );
}

export const dynamic = 'force-dynamic';

export default async function StatsPage({
    searchParams
}: {
    readonly searchParams: Promise<StatsSearchParams>;
}) {
    const params = await searchParams;
    const period = isDashboardPeriod(params.period) ? params.period : 'day';
    const client = await getApiClient();
    const me = await client.auth.me();
    const selectedDate = parseDateParam(params.date, me.timezone);
    const anchorDate = selectedDate ?? new Date();
    const window = await client.stats.window({
        query: {
            after: 2,
            before: 2,
            period,
            ...(selectedDate ? { date: selectedDate } : {})
        }
    });

    return (
        <StatsExplorer
            initialDate={initialStatsDate(window, anchorDate, me.timezone)}
            initialPeriod={period}
            initialWindow={window}
            timezone={me.timezone}
        />
    );
}
