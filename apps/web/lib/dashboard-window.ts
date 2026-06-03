import type { DashboardWindowResponse } from '@xpenser/contracts';
import { dateParam, parseDateParam } from './dashboard-periods';

type DashboardWindowItem = DashboardWindowResponse['items'][number];

export function dashboardWindowItemDateForAnchor(
    items: readonly DashboardWindowItem[],
    date: string,
    timezone: string
): string | undefined {
    const anchor = parseDateParam(date, timezone);
    if (!anchor) {
        return items.find(item => item.date === date)?.date;
    }

    return (
        items.find(item => {
            const from = new Date(item.summary.from);
            const to = new Date(item.summary.to);
            return anchor >= from && anchor <= to;
        })?.date ?? items.find(item => item.date === date)?.date
    );
}

export function initialDashboardWindowDate(
    window: DashboardWindowResponse,
    anchorDate: Date,
    timezone: string
): string {
    return (
        dashboardWindowItemDateForAnchor(
            window.items,
            dateParam(anchorDate, timezone),
            timezone
        ) ?? dateParam(anchorDate, timezone)
    );
}
