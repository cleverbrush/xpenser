'use client';

import type {
    Category,
    Currency,
    DashboardSummary,
    DashboardWindowResponse,
    Vendor
} from '@xpenser/contracts';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@xpenser/ui';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { AddTransactionDialog } from '@/components/add-transaction-dialog';
import { AmountDisplay } from '@/components/amount-display';
import { DashboardSummaryCards } from '@/components/dashboard-summary-cards';
import { DashboardWindowExplorer } from '@/components/dashboard-window-explorer';
import {
    DatatypeChart,
    datatypeExpression,
    datatypePieExpression
} from '@/components/datatype-chart';
import { CollapsibleReportCategoryGroup } from '@/components/report-category-group';
import { categoryTypeLabel } from '@/lib/category-display';
import { dashboardCategoryShare } from '@/lib/dashboard-category-share';
import { dateParam, formatDashboardRangeLabel } from '@/lib/dashboard-periods';
import {
    amountClassNameForCategoryTotal,
    amountClassNameForType,
    formatPercent,
    formatSignedPercent,
    percentChangeClassNameForCategory,
    signedCategoryTotal
} from '@/lib/format';
import {
    buildReportCategoryNodes,
    type ReportCategoryNode
} from '@/lib/report-category-tree';

type DashboardPeriod = DashboardSummary['period'];
type DashboardCategory = DashboardSummary['byCategory'][number];
type AggregateType = DashboardCategory['type'];
const dashboardWindowQueryParams = { vendorLimit: 0 } as const;

function categoryHref(
    summary: DashboardSummary,
    category: DashboardCategory,
    timezone: string,
    parentRollup = false
): string {
    const params = new URLSearchParams({
        type: category.type,
        from: dateParam(summary.from, timezone),
        to: dateParam(summary.to, timezone)
    });
    params.set(
        parentRollup ? 'parentCategoryId' : 'categoryId',
        String(category.categoryId)
    );
    return `/transactions?${params.toString()}`;
}

type DashboardCategoryNode = ReportCategoryNode<DashboardCategory>;

function fallbackDashboardParentCategory(
    parentId: number,
    categories: readonly DashboardCategory[],
    type: AggregateType,
    parentName: string
): DashboardCategory {
    const trendLength = Math.max(
        ...categories.map(category => category.trend.length),
        0
    );

    return {
        categoryId: parentId,
        categoryName: parentName,
        categoryDisplayName: parentName,
        categoryParentId: null,
        categoryKind: 'normal',
        percentChange: 0,
        previousPeriodTotal: categories.reduce(
            (sum, category) => sum + category.previousPeriodTotal,
            0
        ),
        total: categories.reduce((sum, category) => sum + category.total, 0),
        transactionCount: categories.reduce(
            (sum, category) => sum + category.transactionCount,
            0
        ),
        trend: Array.from({ length: trendLength }, (_, index) =>
            categories.reduce(
                (sum, category) => sum + (category.trend[index] ?? 0),
                0
            )
        ),
        type
    };
}

function buildDashboardCategoryNodes(
    summary: DashboardSummary,
    type: AggregateType
): DashboardCategoryNode[] {
    return buildReportCategoryNodes({
        categories: summary.byCategory,
        createParentCategory: fallbackDashboardParentCategory,
        parentCategories: summary.byParentCategory,
        type
    });
}

function categoryRowLabel(
    category: DashboardCategory,
    parent?: DashboardCategory
): string {
    if (!parent || category.categoryParentId !== null) {
        return category.categoryName;
    }
    return 'General';
}

function childCategoryShare(
    parent: DashboardCategory,
    category: DashboardCategory
): number {
    const basis = Math.abs(parent.total);
    if (basis <= 0) {
        return 0;
    }

    const share = (Math.abs(category.total) / basis) * 100;
    return Math.max(0, Math.min(100, share));
}

function CategoryRow({
    category,
    depth = 0,
    expanded = false,
    expandable = false,
    label,
    onToggle,
    parentRollup = false,
    shareOverride,
    shareTitleOverride,
    summary,
    timezone
}: {
    readonly category: DashboardCategory;
    readonly depth?: number;
    readonly expanded?: boolean;
    readonly expandable?: boolean;
    readonly label?: string;
    readonly onToggle?: () => void;
    readonly parentRollup?: boolean;
    readonly shareOverride?: number;
    readonly shareTitleOverride?: string;
    readonly summary: DashboardSummary;
    readonly timezone: string;
}) {
    const showPeriodDetails = summary.period !== 'day';
    const effectiveType = category.type;
    const percentChange = formatSignedPercent(category.percentChange);
    const share = shareOverride ?? dashboardCategoryShare(summary, category);
    const shareLabel = formatPercent(share);
    const shareTitle =
        shareTitleOverride ??
        (category.type === 'income' ? 'Share of income' : 'Share of expenses');
    const href = categoryHref(summary, category, timezone, parentRollup);
    const displayLabel = label ?? category.categoryDisplayName;
    const isChild = depth > 0;
    const rowClassName = `grid items-center gap-3 py-3 text-sm transition-colors hover:bg-muted/40 sm:px-2 ${
        showPeriodDetails
            ? 'grid-cols-[minmax(0,1fr)_auto_74px] sm:grid-cols-[minmax(0,1fr)_auto_104px]'
            : 'grid-cols-[minmax(0,1fr)_auto]'
    }`;

    return (
        <div className={rowClassName}>
            <div
                className={`relative flex min-w-0 items-center ${
                    isChild ? 'pl-3' : ''
                }`}
            >
                {expandable ? (
                    <Button
                        aria-label={`${
                            expanded ? 'Collapse' : 'Expand'
                        } ${category.categoryDisplayName}`}
                        className="-left-3 absolute top-1/2 size-4 -translate-y-1/2 rounded-sm"
                        onClick={onToggle}
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
                ) : null}
                <Link
                    className="flex min-w-0 items-center gap-3"
                    draggable={false}
                    href={href}
                    prefetch={false}
                >
                    <span
                        className={`flex w-10 shrink-0 flex-col items-center justify-center ${
                            isChild
                                ? 'text-muted-foreground'
                                : amountClassNameForType(effectiveType)
                        }`}
                        title={`${shareTitle}: ${shareLabel}`}
                    >
                        {isChild ? (
                            <span
                                className={`text-xs font-medium tabular-nums ${amountClassNameForType(effectiveType)}`}
                            >
                                <span className="sr-only">{shareTitle}: </span>
                                {shareLabel}
                            </span>
                        ) : (
                            <>
                                <DatatypeChart
                                    className="text-2xl"
                                    expression={datatypePieExpression(share)}
                                />
                                <span className="mt-0.5 text-[0.65rem] font-medium leading-none tabular-nums">
                                    <span className="sr-only">
                                        {shareTitle}:{' '}
                                    </span>
                                    {shareLabel}
                                </span>
                            </>
                        )}
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate font-medium">
                            {displayLabel}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {category.transactionCount}{' '}
                            {category.transactionCount === 1
                                ? 'transaction'
                                : 'transactions'}
                            {isChild ? (
                                <> · {categoryTypeLabel(effectiveType)}</>
                            ) : null}
                        </span>
                    </span>
                </Link>
            </div>
            <Link
                className="min-w-0 text-right"
                draggable={false}
                href={href}
                prefetch={false}
            >
                <span
                    className={`font-semibold ${amountClassNameForCategoryTotal(
                        category.total,
                        category.type
                    )}`}
                >
                    <AmountDisplay
                        currency={summary.currency}
                        value={signedCategoryTotal(
                            category.total,
                            category.type
                        )}
                    />
                </span>
                {showPeriodDetails ? (
                    <span
                        className={`block text-xs font-medium ${percentChangeClassNameForCategory(
                            category.percentChange,
                            category.type
                        )}`}
                        title={`Change from previous ${summary.period}: ${percentChange}`}
                    >
                        <span className="sr-only">
                            Change from previous {summary.period}:{' '}
                        </span>
                        {percentChange}
                    </span>
                ) : null}
            </Link>
            {showPeriodDetails ? (
                <Link
                    aria-label={`${displayLabel} transactions`}
                    className="flex min-w-0 justify-end overflow-hidden"
                    draggable={false}
                    href={href}
                    prefetch={false}
                >
                    <DatatypeChart
                        className={`text-xl ${amountClassNameForCategoryTotal(
                            category.total,
                            category.type
                        )}`}
                        expression={datatypeExpression('l', category.trend)}
                    />
                </Link>
            ) : null}
        </div>
    );
}

function CategoryGroup({
    nodes,
    summary,
    timezone,
    title
}: {
    readonly nodes: readonly DashboardCategoryNode[];
    readonly summary: DashboardSummary;
    readonly timezone: string;
    readonly title: string;
}) {
    if (nodes.length === 0) {
        return null;
    }

    return (
        <div>
            <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                {title}
            </h3>
            <CollapsibleReportCategoryGroup
                empty={null}
                nodes={nodes}
                renderChild={({ child, parent }) => (
                    <CategoryRow
                        category={child}
                        depth={1}
                        label={categoryRowLabel(child, parent)}
                        shareOverride={childCategoryShare(parent, child)}
                        shareTitleOverride={`Share of ${parent.categoryName}`}
                        summary={summary}
                        timezone={timezone}
                    />
                )}
                renderParent={({ expandable, expanded, node, onToggle }) => (
                    <CategoryRow
                        category={node.category}
                        expandable={expandable}
                        expanded={expanded}
                        onToggle={onToggle}
                        parentRollup={expandable}
                        summary={summary}
                        timezone={timezone}
                    />
                )}
            />
        </div>
    );
}

function CategoryPanel({
    summary,
    timezone
}: {
    readonly summary: DashboardSummary;
    readonly timezone: string;
}) {
    const incomeCategories = buildDashboardCategoryNodes(summary, 'income');
    const expenseCategories = buildDashboardCategoryNodes(summary, 'expense');

    if (incomeCategories.length === 0 && expenseCategories.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4">
                    <CategoryGroup
                        nodes={incomeCategories}
                        summary={summary}
                        timezone={timezone}
                        title="Income"
                    />
                    <CategoryGroup
                        nodes={expenseCategories}
                        summary={summary}
                        timezone={timezone}
                        title="Expenses"
                    />
                </div>
            </CardContent>
        </Card>
    );
}

function DashboardPeriodPanel({
    summary,
    timezone
}: {
    readonly summary: DashboardSummary;
    readonly timezone: string;
}) {
    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <DashboardSummaryCards summary={summary} timezone={timezone} />
            <CategoryPanel summary={summary} timezone={timezone} />
        </div>
    );
}

function DashboardPeriodPanelSkeleton() {
    const cards = ['Income', 'Expenses', 'Net'];

    return (
        <div className="flex flex-col gap-5 sm:gap-6" aria-hidden>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {cards.map(label => (
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
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4">
                        {['Income', 'Expenses'].map(group => (
                            <div key={group}>
                                <div className="mb-2 h-3 w-16 rounded-md bg-muted" />
                                <div className="flex flex-col divide-y">
                                    <div className="grid grid-cols-[minmax(0,1fr)_auto_74px] items-center gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_104px]">
                                        <div className="space-y-2">
                                            <div className="h-4 w-28 rounded-md bg-muted" />
                                            <div className="h-3 w-20 rounded-md bg-muted" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="ml-auto h-4 w-16 rounded-md bg-muted" />
                                            <div className="ml-auto h-3 w-10 rounded-md bg-muted" />
                                        </div>
                                        <div className="h-5 w-full rounded-md bg-muted" />
                                    </div>
                                    <div className="grid grid-cols-[minmax(0,1fr)_auto_74px] items-center gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_104px]">
                                        <div className="space-y-2">
                                            <div className="h-4 w-24 rounded-md bg-muted" />
                                            <div className="h-3 w-16 rounded-md bg-muted" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="ml-auto h-4 w-14 rounded-md bg-muted" />
                                            <div className="ml-auto h-3 w-9 rounded-md bg-muted" />
                                        </div>
                                        <div className="h-5 w-full rounded-md bg-muted" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export function DashboardExplorer({
    categories,
    currencies,
    defaultCurrency,
    initialDate,
    initialPeriod,
    initialWindow,
    vendors,
    timezone,
    transactionCurrencies
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly initialDate: string;
    readonly initialPeriod: DashboardPeriod;
    readonly initialWindow: DashboardWindowResponse;
    readonly vendors: readonly Vendor[];
    readonly timezone: string;
    readonly transactionCurrencies: readonly string[];
}) {
    return (
        <DashboardWindowExplorer
            basePath="/dashboard"
            initialDate={initialDate}
            initialPeriod={initialPeriod}
            initialWindow={initialWindow}
            renderBody={({ item }) => (
                <DashboardPeriodPanel
                    summary={item.summary}
                    timezone={timezone}
                />
            )}
            renderHeader={({ item, period }) => (
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold">Dashboard</h1>
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
            skeleton={<DashboardPeriodPanelSkeleton />}
            timezone={timezone}
            windowQueryParams={dashboardWindowQueryParams}
        />
    );
}
