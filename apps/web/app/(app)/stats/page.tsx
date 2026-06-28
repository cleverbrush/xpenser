import type { StatsTagReport, StatsWindowResponse } from '@xpenser/contracts';
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
    readonly tag?: string;
    readonly view?: string;
};

type ReportView = 'categories' | 'overview' | 'tags';
type ReportTagSelection = number | 'untagged' | undefined;

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

function reportView(value?: string): ReportView {
    return value === 'categories' || value === 'tags' ? value : 'overview';
}

function reportTag(value?: string): ReportTagSelection {
    if (value === 'untagged') {
        return 'untagged';
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

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
    const initialView = reportView(params.view);
    const initialTag = reportTag(params.tag);
    const [currencies, window] = await Promise.all([
        client.currencies.list(),
        client.stats.window({
            query: {
                after: 2,
                before: 2,
                period,
                ...(selectedDate ? { date: selectedDate } : {})
            }
        })
    ]);
    const initialTagReport: StatsTagReport | null =
        initialView === 'tags'
            ? await client.stats.tags({
                  query: {
                      period,
                      ...(selectedDate ? { date: selectedDate } : {}),
                      ...(initialTag ? { tag: initialTag } : {})
                  }
              })
            : null;

    return (
        <StatsExplorer
            currencies={currencies}
            defaultCurrency={me.defaultCurrency}
            favoriteCurrencies={me.favoriteCurrencies}
            initialDate={initialStatsDate(window, anchorDate, me.timezone)}
            initialPeriod={period}
            initialTag={initialTag}
            initialTagReport={initialTagReport}
            initialView={initialView}
            initialWindow={window}
            timezone={me.timezone}
        />
    );
}
