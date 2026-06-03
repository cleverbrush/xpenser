'use client';

import type {
    DashboardSummary,
    DashboardWindowResponse
} from '@xpenser/contracts';
import { DashboardWindowExplorer } from '@/components/dashboard-window-explorer';
import {
    VendorAnalyticsPanel,
    VendorAnalyticsPanelSkeleton
} from '@/components/vendor-analytics-panel';
import { formatDashboardRangeLabel } from '@/lib/dashboard-periods';
import { vendorAnalyticsVendorLimit } from '@/lib/vendor-analytics';

type DashboardPeriod = DashboardSummary['period'];
const vendorsWindowQueryParams = {
    vendorLimit: vendorAnalyticsVendorLimit
} as const;

export function VendorsExplorer({
    initialDate,
    initialPeriod,
    initialWindow,
    timezone
}: {
    readonly initialDate: string;
    readonly initialPeriod: DashboardPeriod;
    readonly initialWindow: DashboardWindowResponse;
    readonly timezone: string;
}) {
    return (
        <DashboardWindowExplorer
            basePath="/vendors"
            initialDate={initialDate}
            initialPeriod={initialPeriod}
            initialWindow={initialWindow}
            renderBody={({ item }) => (
                <VendorAnalyticsPanel
                    summary={item.summary}
                    timezone={timezone}
                />
            )}
            renderHeader={({ item, period }) => (
                <div>
                    <h1 className="text-2xl font-semibold">Vendors</h1>
                    <p className="text-sm text-muted-foreground">
                        {formatDashboardRangeLabel({
                            from: item.summary.from,
                            period,
                            to: item.summary.to,
                            timeZone: timezone
                        })}{' '}
                        in {item.summary.currency}.
                    </p>
                </div>
            )}
            skeleton={<VendorAnalyticsPanelSkeleton />}
            timezone={timezone}
            windowQueryParams={vendorsWindowQueryParams}
        />
    );
}
