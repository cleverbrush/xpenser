'use client';

import type { DashboardSummary } from '@xpenser/contracts';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import Link from 'next/link';
import { AmountDisplay } from '@/components/amount-display';
import { MerchantLogo } from '@/components/merchant-display';
import { dateParam } from '@/lib/dashboard-periods';
import {
    amountClassNameForCategoryTotal,
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

function DashboardMerchantRow({
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
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-sm transition-colors hover:bg-muted/40 sm:px-2"
            draggable={false}
            href={merchantHref(summary, merchant, timezone)}
            prefetch={false}
        >
            <span className="flex min-w-0 items-center gap-3">
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
            </span>
            <span
                className={`font-semibold ${amountClassNameForCategoryTotal(
                    merchant.expenseTotal,
                    'expense'
                )}`}
            >
                <AmountDisplay
                    currency={summary.currency}
                    value={signedCategoryTotal(
                        merchant.expenseTotal,
                        'expense'
                    )}
                />
            </span>
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
    if (summary.topMerchants.length === 0) {
        return null;
    }

    const rowMerchants = summary.topMerchants.slice(0, 8);
    const extraMerchants = summary.topMerchants.slice(8, 24);
    const overflowCount = Math.max(
        0,
        summary.merchantCount - summary.topMerchants.length
    );
    const showAllLink = summary.merchantCount > rowMerchants.length;

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                    <CardTitle>Merchants</CardTitle>
                    <CardDescription>
                        {summary.merchantCount}{' '}
                        {summary.merchantCount === 1 ? 'brand' : 'brands'} in
                        this period
                    </CardDescription>
                </div>
                {showAllLink ? (
                    <Link
                        className="shrink-0 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                        draggable={false}
                        href={aggregateHref(summary, timezone)}
                        prefetch={false}
                    >
                        View all
                    </Link>
                ) : null}
            </CardHeader>
            <CardContent>
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
                                href={merchantHref(summary, merchant, timezone)}
                                key={merchant.merchantId}
                                prefetch={false}
                                title={merchant.merchantName}
                            >
                                <MerchantLogo
                                    merchant={{
                                        displayName: merchant.merchantName,
                                        logoUrl: merchant.merchantLogoUrl,
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
            </CardContent>
        </Card>
    );
}
