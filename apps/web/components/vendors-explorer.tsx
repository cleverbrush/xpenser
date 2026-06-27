'use client';

import type {
    Category,
    Currency,
    DashboardSummary,
    DashboardWindowResponse,
    TransactionTag,
    Vendor
} from '@xpenser/contracts';
import { useMemo } from 'react';
import { AddTransactionDialog } from '@/components/add-transaction-dialog';
import { DashboardViewSettingsMenu } from '@/components/dashboard-view-settings-menu';
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
    favoriteCurrencies,
    initialDate,
    initialPeriod,
    initialWindow,
    selectedCurrency,
    vendors,
    transactionTags,
    transactionCurrencies,
    timezone
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly favoriteCurrencies: readonly string[];
    readonly initialDate: string;
    readonly initialPeriod: DashboardPeriod;
    readonly initialWindow: DashboardWindowResponse;
    readonly selectedCurrency: string;
    readonly vendors: readonly Vendor[];
    readonly transactionTags: readonly TransactionTag[];
    readonly transactionCurrencies: readonly string[];
    readonly timezone: string;
}) {
    const navigationQueryParams = useMemo<
        Readonly<Record<string, string>>
    >(() => {
        const params: Record<string, string> = {};
        if (selectedCurrency !== defaultCurrency) {
            params.currency = selectedCurrency;
        }
        return params;
    }, [defaultCurrency, selectedCurrency]);
    const windowQueryParams = useMemo(
        () => ({
            ...vendorsWindowQueryParams,
            ...navigationQueryParams
        }),
        [navigationQueryParams]
    );

    return (
        <DashboardWindowExplorer
            basePath="/vendors"
            initialDate={initialDate}
            initialPeriod={initialPeriod}
            initialWindow={initialWindow}
            navigationQueryParams={navigationQueryParams}
            renderBody={({ item }) => (
                <VendorAnalyticsPanel
                    summary={item.summary}
                    timezone={timezone}
                />
            )}
            renderHeader={({ currentDate, item, period }) => (
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
                    <div className="flex shrink-0 items-center gap-2">
                        <DashboardViewSettingsMenu
                            basePath="/vendors"
                            currencies={currencies}
                            currentDate={currentDate}
                            defaultCurrency={defaultCurrency}
                            favoriteCurrencies={favoriteCurrencies}
                            period={period}
                            selectedCurrency={item.summary.currency}
                            timezone={timezone}
                        />
                        <AddTransactionDialog
                            categories={categories}
                            currencies={currencies}
                            defaultCurrency={defaultCurrency}
                            vendors={vendors}
                            transactionTags={transactionTags}
                            transactionCurrencies={transactionCurrencies}
                            timezone={timezone}
                        />
                    </div>
                </div>
            )}
            skeleton={<VendorAnalyticsPanelSkeleton />}
            timezone={timezone}
            windowQueryParams={windowQueryParams}
        />
    );
}
