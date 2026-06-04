'use client';

import type {
    Category,
    Currency,
    DashboardSummary,
    DashboardWindowResponse,
    Vendor
} from '@xpenser/contracts';
import { AddTransactionDialog } from '@/components/add-transaction-dialog';
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
    categories,
    currencies,
    defaultCurrency,
    initialDate,
    initialPeriod,
    initialWindow,
    vendors,
    transactionCurrencies,
    timezone
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly initialDate: string;
    readonly initialPeriod: DashboardPeriod;
    readonly initialWindow: DashboardWindowResponse;
    readonly vendors: readonly Vendor[];
    readonly transactionCurrencies: readonly string[];
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
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
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
                    <div className="shrink-0">
                        <AddTransactionDialog
                            categories={categories}
                            currencies={currencies}
                            defaultCurrency={defaultCurrency}
                            vendors={vendors}
                            transactionCurrencies={transactionCurrencies}
                            timezone={timezone}
                        />
                    </div>
                </div>
            )}
            skeleton={<VendorAnalyticsPanelSkeleton />}
            timezone={timezone}
            windowQueryParams={vendorsWindowQueryParams}
        />
    );
}
