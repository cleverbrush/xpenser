'use client';

import type { DashboardSummary } from '@xpenser/contracts';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import { InfoIcon } from 'lucide-react';
import Link from 'next/link';
import { AmountDisplay } from '@/components/amount-display';
import { DashboardSummaryCards } from '@/components/dashboard-summary-cards';
import {
    DatatypeChart,
    datatypeExpression,
    datatypePieExpression
} from '@/components/datatype-chart';
import { MerchantLogo } from '@/components/merchant-display';
import { dateParam } from '@/lib/dashboard-periods';
import {
    amountClassNameForCategoryTotal,
    formatPercent,
    signedCategoryTotal
} from '@/lib/format';

type DashboardMerchant = DashboardSummary['topMerchants'][number];

function merchantHref(
    summary: DashboardSummary,
    merchant: Pick<DashboardMerchant, 'merchantId'>,
    timezone: string
): string {
    const params = new URLSearchParams({
        type: 'expense',
        from: dateParam(summary.from, timezone),
        to: dateParam(summary.to, timezone),
        merchantId: String(merchant.merchantId)
    });
    return `/transactions?${params.toString()}`;
}

function merchantPurchaseLabel(count: number): string {
    return `${count} ${count === 1 ? 'purchase' : 'purchases'}`;
}

function merchantExpenseShare(
    summary: Pick<DashboardSummary, 'expenseTotal'>,
    merchant: Pick<DashboardMerchant, 'expenseTotal'>
): number {
    const basis = Math.abs(summary.expenseTotal);
    if (basis <= 0) {
        return 0;
    }

    const share = (Math.abs(merchant.expenseTotal) / basis) * 100;
    return Math.max(0, Math.min(100, share));
}

function BrandRow({
    merchant,
    summary,
    timezone
}: {
    readonly merchant: DashboardMerchant;
    readonly summary: DashboardSummary;
    readonly timezone: string;
}) {
    const share = merchantExpenseShare(summary, merchant);
    const shareLabel = formatPercent(share);
    const showPeriodDetails = summary.period !== 'day';
    const href = merchantHref(summary, merchant, timezone);
    const amountClassName = amountClassNameForCategoryTotal(
        merchant.expenseTotal,
        'expense'
    );
    const rowClassName = `grid items-center gap-3 py-3 text-sm transition-colors hover:bg-muted/40 sm:px-2 ${
        showPeriodDetails
            ? 'grid-cols-[minmax(0,1fr)_auto_74px] sm:grid-cols-[minmax(0,1fr)_auto_104px]'
            : 'grid-cols-[minmax(0,1fr)_auto]'
    }`;

    return (
        <div className={rowClassName}>
            <Link
                className="flex min-w-0 items-center gap-3"
                draggable={false}
                href={href}
                prefetch={false}
            >
                <span
                    className="flex w-10 shrink-0 flex-col items-center justify-center text-rose-700 dark:text-rose-400"
                    title={`Share of expenses: ${shareLabel}`}
                >
                    <DatatypeChart
                        className="text-2xl"
                        expression={datatypePieExpression(share)}
                    />
                    <span className="mt-0.5 text-[0.65rem] font-medium leading-none tabular-nums">
                        <span className="sr-only">Share of expenses: </span>
                        {shareLabel}
                    </span>
                </span>
                <MerchantLogo
                    merchant={{
                        displayName: merchant.merchantName,
                        logoUrl: merchant.merchantLogoUrl,
                        name: merchant.merchantName
                    }}
                    size="sm"
                />
                <span className="min-w-0">
                    <span className="block truncate font-medium">
                        {merchant.merchantName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                        {merchant.merchantDomain
                            ? `${merchant.merchantDomain} · ${merchantPurchaseLabel(
                                  merchant.transactionCount
                              )}`
                            : merchantPurchaseLabel(merchant.transactionCount)}
                    </span>
                </span>
            </Link>
            <Link
                className="min-w-0 text-right"
                draggable={false}
                href={href}
                prefetch={false}
            >
                <span className={`font-semibold ${amountClassName}`}>
                    <AmountDisplay
                        currency={summary.currency}
                        value={signedCategoryTotal(
                            merchant.expenseTotal,
                            'expense'
                        )}
                    />
                </span>
            </Link>
            {showPeriodDetails ? (
                <Link
                    aria-label={`${merchant.merchantName} transactions`}
                    className="flex min-w-0 justify-end overflow-hidden"
                    draggable={false}
                    href={href}
                    prefetch={false}
                >
                    <DatatypeChart
                        className={`text-xl ${amountClassName}`}
                        expression={datatypeExpression('l', merchant.trend)}
                    />
                </Link>
            ) : null}
        </div>
    );
}

function BrandsHeader({ summary }: { readonly summary: DashboardSummary }) {
    return (
        <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <CardTitle>Brands</CardTitle>
                        <span
                            aria-label="Brand grouping info"
                            className="inline-flex text-muted-foreground"
                            role="img"
                            title="Only expenses linked to a merchant are grouped here."
                        >
                            <InfoIcon aria-hidden className="size-4" />
                        </span>
                    </div>
                    <CardDescription>
                        {summary.merchantCount}{' '}
                        {summary.merchantCount === 1 ? 'brand' : 'brands'} in
                        this period
                    </CardDescription>
                </div>
                {summary.merchantCount > summary.topMerchants.length ? (
                    <p className="text-xs text-muted-foreground">
                        Showing top {summary.topMerchants.length}
                    </p>
                ) : null}
            </div>
        </CardHeader>
    );
}

export function BrandAnalyticsPanel({
    summary,
    timezone
}: {
    readonly summary: DashboardSummary;
    readonly timezone: string;
}) {
    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <DashboardSummaryCards summary={summary} timezone={timezone} />
            <Card>
                <BrandsHeader summary={summary} />
                <CardContent>
                    {summary.topMerchants.length > 0 ? (
                        <div className="flex flex-col divide-y">
                            {summary.topMerchants.map(merchant => (
                                <BrandRow
                                    key={merchant.merchantId}
                                    merchant={merchant}
                                    summary={summary}
                                    timezone={timezone}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No brands in this period.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export function BrandAnalyticsPanelSkeleton() {
    return (
        <div className="flex flex-col gap-5 sm:gap-6" aria-hidden>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {['Income', 'Expenses', 'Net'].map(label => (
                    <Card className="min-w-0" key={label}>
                        <CardHeader className="min-w-0 p-3 sm:p-4">
                            <div className="h-3 w-14 rounded-md bg-muted" />
                            <div className="h-5 w-20 rounded-md bg-muted" />
                        </CardHeader>
                    </Card>
                ))}
            </div>
            <Card>
                <CardHeader>
                    <div className="h-6 w-24 rounded-md bg-muted" />
                    <div className="h-3 w-28 rounded-md bg-muted" />
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col divide-y">
                        {[1, 2, 3, 4].map(item => (
                            <div
                                className="grid grid-cols-[minmax(0,1fr)_auto_74px] items-center gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_104px]"
                                key={item}
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="size-8 rounded-full bg-muted" />
                                    <div className="space-y-2">
                                        <div className="h-4 w-28 rounded-md bg-muted" />
                                        <div className="h-3 w-20 rounded-md bg-muted" />
                                    </div>
                                </div>
                                <div className="h-4 w-16 rounded-md bg-muted" />
                                <div className="h-5 w-full rounded-md bg-muted" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
