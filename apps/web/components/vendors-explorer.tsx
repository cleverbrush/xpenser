'use client';

import type {
    Category,
    Currency,
    DashboardSummary,
    DashboardWindowResponse,
    TransactionTag,
    Vendor
} from '@xpenser/contracts';
import { useMemo, useState } from 'react';
import { AddTransactionDialog } from '@/components/add-transaction-dialog';
import {
    type DashboardViewExpansionAction,
    DashboardViewSettingsMenu
} from '@/components/dashboard-view-settings-menu';
import { DashboardWindowExplorer } from '@/components/dashboard-window-explorer';
import {
    type ExpandedVendorsBySummaryKey,
    VendorAnalyticsPanel,
    VendorAnalyticsPanelSkeleton,
    vendorAnalyticsExpansionState
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
    const [expandedVendorsBySummaryKey, setExpandedVendorsBySummaryKey] =
        useState<ExpandedVendorsBySummaryKey>({});
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

    function toggleVendorExpansion(summaryKey: string, key: string) {
        setExpandedVendorsBySummaryKey(current => {
            const nextKeys = new Set(current[summaryKey] ?? []);
            if (nextKeys.has(key)) {
                nextKeys.delete(key);
            } else {
                nextKeys.add(key);
            }
            return { ...current, [summaryKey]: Array.from(nextKeys) };
        });
    }

    function setVendorExpansionRows(
        summaryKey: string,
        keys: readonly string[]
    ) {
        setExpandedVendorsBySummaryKey(current => ({
            ...current,
            [summaryKey]: [...keys]
        }));
    }

    function expansionActionFor(
        summary: DashboardSummary
    ): DashboardViewExpansionAction | undefined {
        const expansion = vendorAnalyticsExpansionState(
            summary,
            expandedVendorsBySummaryKey
        );
        if (expansion.expandableKeys.length === 0) {
            return undefined;
        }

        return {
            allExpanded: expansion.allExpanded,
            onToggle: () => {
                setVendorExpansionRows(
                    expansion.summaryKey,
                    expansion.allExpanded ? [] : expansion.expandableKeys
                );
            }
        };
    }

    return (
        <DashboardWindowExplorer
            basePath="/vendors"
            initialDate={initialDate}
            initialPeriod={initialPeriod}
            initialWindow={initialWindow}
            navigationQueryParams={navigationQueryParams}
            renderBody={({ item }) => {
                const expansion = vendorAnalyticsExpansionState(
                    item.summary,
                    expandedVendorsBySummaryKey
                );
                return (
                    <VendorAnalyticsPanel
                        expandedVendors={expansion.expandedVendors}
                        onToggleVendor={key =>
                            toggleVendorExpansion(expansion.summaryKey, key)
                        }
                        summary={item.summary}
                        timezone={timezone}
                    />
                );
            }}
            renderHeader={({ currentDate, item, period }) => {
                const expansionAction = expansionActionFor(item.summary);
                return (
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
                                expansionAction={expansionAction}
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
                );
            }}
            skeleton={<VendorAnalyticsPanelSkeleton />}
            timezone={timezone}
            windowQueryParams={windowQueryParams}
        />
    );
}
