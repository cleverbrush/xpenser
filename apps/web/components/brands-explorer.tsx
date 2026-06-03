'use client';

import type {
    DashboardSummary,
    DashboardWindowResponse
} from '@xpenser/contracts';
import {
    BrandAnalyticsPanel,
    BrandAnalyticsPanelSkeleton
} from '@/components/brand-analytics-panel';
import { DashboardWindowExplorer } from '@/components/dashboard-window-explorer';
import { brandAnalyticsMerchantLimit } from '@/lib/brand-analytics';
import { formatDashboardRangeLabel } from '@/lib/dashboard-periods';

type DashboardPeriod = DashboardSummary['period'];
const brandsWindowQueryParams = {
    merchantLimit: brandAnalyticsMerchantLimit
} as const;

export function BrandsExplorer({
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
            basePath="/merchants"
            initialDate={initialDate}
            initialPeriod={initialPeriod}
            initialWindow={initialWindow}
            renderBody={({ item }) => (
                <BrandAnalyticsPanel
                    summary={item.summary}
                    timezone={timezone}
                />
            )}
            renderHeader={({ item, period }) => (
                <div>
                    <h1 className="text-2xl font-semibold">Brands</h1>
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
            skeleton={<BrandAnalyticsPanelSkeleton />}
            timezone={timezone}
            windowQueryParams={brandsWindowQueryParams}
        />
    );
}
