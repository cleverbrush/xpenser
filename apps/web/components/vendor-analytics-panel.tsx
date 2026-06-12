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
import { VendorLogo } from '@/components/vendor-display';
import { dateParam } from '@/lib/dashboard-periods';
import {
    amountClassNameForCategoryTotal,
    formatPercent,
    signedCategoryTotal
} from '@/lib/format';

type DashboardVendor = DashboardSummary['topVendors'][number];

function vendorHref(
    summary: DashboardSummary,
    vendor: Pick<DashboardVendor, 'type' | 'vendorId'>,
    timezone: string
): string {
    const params = new URLSearchParams({
        type: vendor.type,
        from: dateParam(summary.from, timezone),
        to: dateParam(summary.to, timezone)
    });
    params.set(
        'vendorId',
        vendor.vendorId === null ? 'none' : String(vendor.vendorId)
    );
    return `/transactions?${params.toString()}`;
}

function vendorTransactionLabel(count: number): string {
    return `${count} ${count === 1 ? 'transaction' : 'transactions'}`;
}

function vendorShare(
    summary: Pick<DashboardSummary, 'expenseTotal' | 'incomeTotal'>,
    vendor: Pick<DashboardVendor, 'total' | 'type'>
): number {
    const basis = Math.abs(
        vendor.type === 'income' ? summary.incomeTotal : summary.expenseTotal
    );
    if (basis <= 0) {
        return 0;
    }

    const share = (Math.abs(vendor.total) / basis) * 100;
    return Math.max(0, Math.min(100, share));
}

function compareVendorsByShare(
    summary: Pick<DashboardSummary, 'expenseTotal' | 'incomeTotal'>,
    left: DashboardVendor,
    right: DashboardVendor
): number {
    return (
        vendorShare(summary, right) - vendorShare(summary, left) ||
        Math.abs(right.total) - Math.abs(left.total) ||
        left.vendorName.localeCompare(right.vendorName)
    );
}

function VendorRow({
    vendor,
    summary,
    timezone
}: {
    readonly vendor: DashboardVendor;
    readonly summary: DashboardSummary;
    readonly timezone: string;
}) {
    const share = vendorShare(summary, vendor);
    const shareLabel = formatPercent(share);
    const showPeriodDetails = summary.period !== 'day';
    const href = vendorHref(summary, vendor, timezone);
    const amountClassName = amountClassNameForCategoryTotal(
        vendor.total,
        vendor.type
    );
    const shareTitle =
        vendor.type === 'income' ? 'Share of income' : 'Share of expenses';
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
                    className={`flex w-10 shrink-0 flex-col items-center justify-center ${amountClassName}`}
                    title={`${shareTitle}: ${shareLabel}`}
                >
                    <DatatypeChart
                        className="text-2xl"
                        expression={datatypePieExpression(share)}
                    />
                    <span className="mt-0.5 text-[0.65rem] font-medium leading-none tabular-nums">
                        <span className="sr-only">{shareTitle}: </span>
                        {shareLabel}
                    </span>
                </span>
                <VendorLogo
                    vendor={{
                        displayName: vendor.vendorName,
                        logoUrl: vendor.vendorLogoUrl,
                        name: vendor.vendorName
                    }}
                    size="sm"
                />
                <span className="min-w-0">
                    <span className="block truncate font-medium">
                        {vendor.vendorName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                        {vendor.vendorDomain
                            ? `${vendor.vendorDomain} · ${vendorTransactionLabel(
                                  vendor.transactionCount
                              )}`
                            : vendorTransactionLabel(vendor.transactionCount)}
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
                        value={signedCategoryTotal(vendor.total, vendor.type)}
                    />
                </span>
            </Link>
            {showPeriodDetails ? (
                <Link
                    aria-label={`${vendor.vendorName} ${vendor.type} transactions`}
                    className="flex min-w-0 justify-end overflow-hidden"
                    draggable={false}
                    href={href}
                    prefetch={false}
                >
                    <DatatypeChart
                        className={`text-xl ${amountClassName}`}
                        expression={datatypeExpression('l', vendor.trend)}
                    />
                </Link>
            ) : null}
        </div>
    );
}

function VendorsHeader({ summary }: { readonly summary: DashboardSummary }) {
    return (
        <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <CardTitle>Vendors</CardTitle>
                        <span
                            aria-label="Vendor grouping info"
                            className="inline-flex text-muted-foreground"
                            role="img"
                            title="Transactions are grouped by vendor, including transactions without a vendor."
                        >
                            <InfoIcon aria-hidden className="size-4" />
                        </span>
                    </div>
                    <CardDescription>
                        {summary.vendorCount}{' '}
                        {summary.vendorCount === 1
                            ? 'vendor group'
                            : 'vendor groups'}{' '}
                        in this period
                    </CardDescription>
                </div>
                {summary.vendorCount > summary.topVendors.length ? (
                    <p className="text-xs text-muted-foreground">
                        Showing top {summary.topVendors.length}
                    </p>
                ) : null}
            </div>
        </CardHeader>
    );
}

function VendorGroup({
    summary,
    timezone,
    title,
    type
}: {
    readonly summary: DashboardSummary;
    readonly timezone: string;
    readonly title: string;
    readonly type: DashboardVendor['type'];
}) {
    const vendors = summary.topVendors
        .filter(vendor => vendor.type === type)
        .sort((left, right) => compareVendorsByShare(summary, left, right));
    if (vendors.length === 0) {
        return null;
    }

    return (
        <div>
            <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                {title}
            </h3>
            <div className="flex flex-col divide-y">
                {vendors.map(vendor => (
                    <VendorRow
                        key={`${vendor.type}:${vendor.vendorId ?? 'none'}`}
                        vendor={vendor}
                        summary={summary}
                        timezone={timezone}
                    />
                ))}
            </div>
        </div>
    );
}

export function VendorAnalyticsPanel({
    summary,
    timezone
}: {
    readonly summary: DashboardSummary;
    readonly timezone: string;
}) {
    const hasVendors = summary.topVendors.length > 0;

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <DashboardSummaryCards summary={summary} timezone={timezone} />
            <Card>
                <VendorsHeader summary={summary} />
                <CardContent>
                    {hasVendors ? (
                        <div className="flex flex-col gap-4">
                            <VendorGroup
                                summary={summary}
                                timezone={timezone}
                                title="Income"
                                type="income"
                            />
                            <VendorGroup
                                summary={summary}
                                timezone={timezone}
                                title="Expenses"
                                type="expense"
                            />
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No vendor groups in this period.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export function VendorAnalyticsPanelSkeleton() {
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
