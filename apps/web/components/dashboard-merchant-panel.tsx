'use client';

import type { DashboardSummary } from '@xpenser/contracts';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AmountDisplay } from '@/components/amount-display';
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

function aggregateHref(summary: DashboardSummary, timezone: string): string {
    const params = new URLSearchParams({
        type: 'expense',
        from: dateParam(summary.from, timezone),
        to: dateParam(summary.to, timezone)
    });
    return `/transactions?${params.toString()}`;
}

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

function DashboardMerchantRow({
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

function DashboardMerchantAvatarLink({
    merchant,
    summary,
    timezone
}: {
    readonly merchant: DashboardMerchant;
    readonly summary: DashboardSummary;
    readonly timezone: string;
}) {
    return (
        <Link
            aria-label={`${merchant.merchantName} transactions`}
            className="-ml-2 rounded-full ring-2 ring-background transition-transform first:ml-0 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-ring"
            draggable={false}
            href={merchantHref(summary, merchant, timezone)}
            prefetch={false}
            title={merchant.merchantName}
        >
            <MerchantLogo
                className="rounded-full border bg-background shadow-sm"
                merchant={{
                    displayName: merchant.merchantName,
                    logoUrl: merchant.merchantLogoUrl,
                    name: merchant.merchantName
                }}
                size="md"
            />
        </Link>
    );
}

export function DashboardMerchantPanel({
    summary,
    timezone
}: {
    readonly summary: DashboardSummary;
    readonly timezone: string;
}) {
    const [expanded, setExpanded] = useState(false);

    if (summary.topMerchants.length === 0) {
        return null;
    }

    const rowMerchants = summary.topMerchants.slice(0, 8);
    const extraMerchants = summary.topMerchants.slice(8, 24);
    const compactMerchants = summary.topMerchants.slice(0, 12);
    const compactOverflowCount = Math.max(
        0,
        summary.merchantCount - compactMerchants.length
    );
    const overflowCount = Math.max(
        0,
        summary.merchantCount - summary.topMerchants.length
    );
    const showAllLink = summary.merchantCount > rowMerchants.length;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 p-3 sm:p-4">
                <div className="min-w-0">
                    <CardTitle className="text-base">Merchants</CardTitle>
                    <CardDescription className="text-xs">
                        {summary.merchantCount}{' '}
                        {summary.merchantCount === 1 ? 'brand' : 'brands'} in
                        this period
                    </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {expanded && showAllLink ? (
                        <Link
                            className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
                            draggable={false}
                            href={aggregateHref(summary, timezone)}
                            prefetch={false}
                        >
                            View all
                        </Link>
                    ) : null}
                    <Button
                        aria-label={
                            expanded ? 'Collapse merchants' : 'Expand merchants'
                        }
                        onClick={() => setExpanded(current => !current)}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                    >
                        {expanded ? (
                            <ChevronDownIcon aria-hidden className="size-3" />
                        ) : (
                            <ChevronRightIcon aria-hidden className="size-3" />
                        )}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4 sm:pt-0">
                {expanded ? (
                    <>
                        <div className="flex flex-col divide-y">
                            {rowMerchants.map(merchant => (
                                <DashboardMerchantRow
                                    key={merchant.merchantId}
                                    merchant={merchant}
                                    summary={summary}
                                    timezone={timezone}
                                />
                            ))}
                        </div>
                        {extraMerchants.length > 0 || overflowCount > 0 ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                                {extraMerchants.map(merchant => (
                                    <Link
                                        aria-label={`${merchant.merchantName} transactions`}
                                        className="rounded-md border bg-background p-1 transition-colors hover:bg-muted/50"
                                        draggable={false}
                                        href={merchantHref(
                                            summary,
                                            merchant,
                                            timezone
                                        )}
                                        key={merchant.merchantId}
                                        prefetch={false}
                                        title={merchant.merchantName}
                                    >
                                        <MerchantLogo
                                            merchant={{
                                                displayName:
                                                    merchant.merchantName,
                                                logoUrl:
                                                    merchant.merchantLogoUrl,
                                                name: merchant.merchantName
                                            }}
                                            size="sm"
                                        />
                                    </Link>
                                ))}
                                {overflowCount > 0 ? (
                                    <Link
                                        className="flex h-8 shrink-0 items-center rounded-md border bg-background px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                                        draggable={false}
                                        href={aggregateHref(summary, timezone)}
                                        prefetch={false}
                                    >
                                        +{overflowCount}
                                    </Link>
                                ) : null}
                            </div>
                        ) : null}
                    </>
                ) : (
                    <div className="flex min-w-0 items-center overflow-hidden py-1 pl-1">
                        {compactMerchants.map(merchant => (
                            <DashboardMerchantAvatarLink
                                key={merchant.merchantId}
                                merchant={merchant}
                                summary={summary}
                                timezone={timezone}
                            />
                        ))}
                        {compactOverflowCount > 0 ? (
                            <Link
                                className="-ml-2 flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted px-2 text-xs font-medium text-muted-foreground ring-2 ring-background transition-colors hover:bg-muted/80 hover:text-foreground"
                                draggable={false}
                                href={aggregateHref(summary, timezone)}
                                prefetch={false}
                            >
                                +{compactOverflowCount}
                            </Link>
                        ) : null}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
