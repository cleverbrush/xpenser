'use client';

import type {
    Category,
    Currency,
    DashboardSummary,
    DashboardWindowResponse,
    TransactionTag,
    Vendor
} from '@xpenser/contracts';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@xpenser/ui';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AddTransactionDialog } from '@/components/add-transaction-dialog';
import { AmountDisplay } from '@/components/amount-display';
import { DashboardSummaryCards } from '@/components/dashboard-summary-cards';
import {
    type DashboardViewExpansionAction,
    DashboardViewSettingsMenu
} from '@/components/dashboard-view-settings-menu';
import { DashboardWindowExplorer } from '@/components/dashboard-window-explorer';
import {
    DatatypeChart,
    datatypeExpression,
    datatypePieExpression
} from '@/components/datatype-chart';
import { VendorLogo } from '@/components/vendor-display';
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
type DashboardCategoryVendor =
    DashboardSummary['categoryVendorBreakdown'][number];
type AggregateType = DashboardCategory['type'];
type ExpandedRowsBySummaryKey = Readonly<Record<string, readonly string[]>>;
const dashboardBaseWindowQueryParams = { vendorLimit: 0 } as const;

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

function categoryVendorHref(
    summary: DashboardSummary,
    item: DashboardCategoryVendor,
    timezone: string
): string {
    const params = new URLSearchParams({
        type: item.type,
        from: dateParam(summary.from, timezone),
        to: dateParam(summary.to, timezone),
        categoryId: String(item.categoryId)
    });
    params.set(
        'vendorId',
        item.vendorId === null ? 'none' : String(item.vendorId)
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

function vendorTransactionLabel(count: number): string {
    return `${count} ${count === 1 ? 'transaction' : 'transactions'}`;
}

function shareOfTotal(total: number, basis: number): number {
    const magnitudeBasis = Math.abs(basis);
    if (magnitudeBasis <= 0) {
        return 0;
    }

    const share = (Math.abs(total) / magnitudeBasis) * 100;
    return Math.max(0, Math.min(100, share));
}

function childCategoryShare(
    parent: DashboardCategory,
    category: DashboardCategory
): number {
    return shareOfTotal(category.total, parent.total);
}

function categoryVendorShare(
    category: DashboardCategory,
    item: DashboardCategoryVendor
): number {
    return shareOfTotal(item.total, category.total);
}

function categoryVendorKey(item: DashboardCategoryVendor): string {
    return `${item.type}:${item.categoryId}:${item.vendorId ?? 'none'}`;
}

function categoryVendorRows(
    summary: DashboardSummary,
    category: DashboardCategory
): DashboardCategoryVendor[] {
    return summary.categoryVendorBreakdown
        .filter(
            item =>
                item.type === category.type &&
                item.categoryId === category.categoryId
        )
        .sort(
            (left, right) =>
                categoryVendorShare(category, right) -
                    categoryVendorShare(category, left) ||
                Math.abs(right.total) - Math.abs(left.total) ||
                left.vendorName.localeCompare(right.vendorName)
        );
}

function categoryExpansionKey(category: DashboardCategory): string {
    return `category:${category.type}:${category.categoryId}`;
}

function categoryVendorExpansionKey(category: DashboardCategory): string {
    return `category-vendors:${category.type}:${category.categoryId}`;
}

function dashboardCategoryExpansionKeys(
    summary: DashboardSummary,
    nodes: readonly DashboardCategoryNode[]
): string[] {
    const keys: string[] = [];

    for (const node of nodes) {
        if (node.children.length > 0) {
            keys.push(categoryExpansionKey(node.category));
            for (const child of node.children) {
                if (categoryVendorRows(summary, child).length > 0) {
                    keys.push(categoryVendorExpansionKey(child));
                }
            }
            continue;
        }

        if (categoryVendorRows(summary, node.category).length > 0) {
            keys.push(categoryVendorExpansionKey(node.category));
        }
    }

    return keys;
}

function dashboardSummaryExpansionKey(summary: DashboardSummary): string {
    return `${summary.period}:${String(summary.from)}:${String(summary.to)}:${
        summary.currency
    }`;
}

function dashboardCategoryExpansionState(
    summary: DashboardSummary,
    expandedRowsBySummaryKey: ExpandedRowsBySummaryKey
): {
    readonly allExpanded: boolean;
    readonly expandableKeys: readonly string[];
    readonly expandedRows: ReadonlySet<string>;
    readonly summaryKey: string;
} {
    const incomeCategories = buildDashboardCategoryNodes(summary, 'income');
    const expenseCategories = buildDashboardCategoryNodes(summary, 'expense');
    const expandableKeys = [
        ...dashboardCategoryExpansionKeys(summary, incomeCategories),
        ...dashboardCategoryExpansionKeys(summary, expenseCategories)
    ];
    const summaryKey = dashboardSummaryExpansionKey(summary);
    const expandedRows = new Set(expandedRowsBySummaryKey[summaryKey] ?? []);
    const allExpanded =
        expandableKeys.length > 0 &&
        expandableKeys.every(key => expandedRows.has(key));

    return {
        allExpanded,
        expandableKeys,
        expandedRows,
        summaryKey
    };
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
    timezone,
    toggleLabel
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
    readonly toggleLabel?: string;
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
    const accessibleToggleLabel = toggleLabel ?? displayLabel;
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
                        } ${accessibleToggleLabel}`}
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

function CategoryVendorRow({
    category,
    categoryLabel,
    item,
    summary,
    timezone
}: {
    readonly category: DashboardCategory;
    readonly categoryLabel: string;
    readonly item: DashboardCategoryVendor;
    readonly summary: DashboardSummary;
    readonly timezone: string;
}) {
    const showPeriodDetails = summary.period !== 'day';
    const share = categoryVendorShare(category, item);
    const shareLabel = formatPercent(share);
    const href = categoryVendorHref(summary, item, timezone);
    const amountClassName = amountClassNameForCategoryTotal(
        item.total,
        item.type
    );
    const rowClassName = `grid items-center gap-3 py-3 text-sm transition-colors hover:bg-muted/40 sm:px-2 ${
        showPeriodDetails
            ? 'grid-cols-[minmax(0,1fr)_auto_74px] sm:grid-cols-[minmax(0,1fr)_auto_104px]'
            : 'grid-cols-[minmax(0,1fr)_auto]'
    }`;

    return (
        <div className={rowClassName}>
            <Link
                className="flex min-w-0 items-center gap-3 pl-6"
                draggable={false}
                href={href}
                prefetch={false}
            >
                <span
                    className={`flex w-10 shrink-0 justify-center text-xs font-medium tabular-nums ${amountClassNameForType(
                        item.type
                    )}`}
                    title={`Share of ${categoryLabel}: ${shareLabel}`}
                >
                    <span className="sr-only">Share of {categoryLabel}: </span>
                    {shareLabel}
                </span>
                <VendorLogo
                    vendor={{
                        displayName: item.vendorName,
                        logoUrl: item.vendorLogoUrl,
                        name: item.vendorName
                    }}
                    size="sm"
                />
                <span className="min-w-0">
                    <span className="block truncate font-medium">
                        {item.vendorName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                        {item.vendorDomain
                            ? `${item.vendorDomain} · ${vendorTransactionLabel(
                                  item.transactionCount
                              )}`
                            : vendorTransactionLabel(item.transactionCount)}
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
                        value={signedCategoryTotal(item.total, item.type)}
                    />
                </span>
            </Link>
            {showPeriodDetails ? (
                <Link
                    aria-label={`${item.vendorName} ${categoryLabel} transactions`}
                    className="flex min-w-0 justify-end overflow-hidden"
                    draggable={false}
                    href={href}
                    prefetch={false}
                >
                    <DatatypeChart
                        className={`text-xl ${amountClassName}`}
                        expression={datatypeExpression('l', item.trend)}
                    />
                </Link>
            ) : null}
        </div>
    );
}

function CategoryRowWithVendors({
    category,
    depth = 0,
    expandedRows,
    expansionKey,
    label,
    onToggleExpansion,
    shareOverride,
    shareTitleOverride,
    summary,
    timezone
}: {
    readonly category: DashboardCategory;
    readonly depth?: number;
    readonly expandedRows?: ReadonlySet<string>;
    readonly expansionKey?: string;
    readonly label?: string;
    readonly onToggleExpansion?: (key: string) => void;
    readonly shareOverride?: number;
    readonly shareTitleOverride?: string;
    readonly summary: DashboardSummary;
    readonly timezone: string;
}) {
    const [localExpanded, setLocalExpanded] = useState(false);
    const vendors = categoryVendorRows(summary, category);
    const displayLabel = label ?? category.categoryDisplayName;
    const expandable = vendors.length > 0;
    const expanded =
        expansionKey && expandedRows
            ? expandedRows.has(expansionKey)
            : localExpanded;

    function toggleExpanded() {
        if (expansionKey && onToggleExpansion) {
            onToggleExpansion(expansionKey);
            return;
        }

        setLocalExpanded(current => !current);
    }

    return (
        <div className="flex flex-col">
            <CategoryRow
                category={category}
                depth={depth}
                expandable={expandable}
                expanded={expanded}
                label={label}
                onToggle={toggleExpanded}
                shareOverride={shareOverride}
                shareTitleOverride={shareTitleOverride}
                summary={summary}
                timezone={timezone}
                toggleLabel={displayLabel}
            />
            {expandable && expanded ? (
                <div className="border-t">
                    {vendors.map(item => (
                        <CategoryVendorRow
                            category={category}
                            categoryLabel={displayLabel}
                            item={item}
                            key={categoryVendorKey(item)}
                            summary={summary}
                            timezone={timezone}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function CategoryGroup({
    expandedRows,
    nodes,
    onToggleExpansion,
    summary,
    timezone,
    title
}: {
    readonly expandedRows: ReadonlySet<string>;
    readonly nodes: readonly DashboardCategoryNode[];
    readonly onToggleExpansion: (key: string) => void;
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
            <div className="flex flex-col divide-y">
                {nodes.map(node => {
                    const hasChildren = node.children.length > 0;
                    const parentKey = categoryExpansionKey(node.category);
                    const expanded = expandedRows.has(parentKey);

                    return (
                        <div className="flex flex-col" key={parentKey}>
                            {hasChildren ? (
                                <CategoryRow
                                    category={node.category}
                                    expandable
                                    expanded={expanded}
                                    onToggle={() =>
                                        onToggleExpansion(parentKey)
                                    }
                                    parentRollup
                                    summary={summary}
                                    timezone={timezone}
                                />
                            ) : (
                                <CategoryRowWithVendors
                                    category={node.category}
                                    expandedRows={expandedRows}
                                    expansionKey={categoryVendorExpansionKey(
                                        node.category
                                    )}
                                    onToggleExpansion={onToggleExpansion}
                                    summary={summary}
                                    timezone={timezone}
                                />
                            )}
                            {hasChildren && expanded ? (
                                <div className="border-t">
                                    {node.children.map(child => (
                                        <CategoryRowWithVendors
                                            category={child}
                                            depth={1}
                                            expandedRows={expandedRows}
                                            expansionKey={categoryVendorExpansionKey(
                                                child
                                            )}
                                            key={`${categoryExpansionKey(
                                                child
                                            )}:${
                                                child.categoryParentId ?? 'self'
                                            }`}
                                            label={categoryRowLabel(
                                                child,
                                                node.category
                                            )}
                                            onToggleExpansion={
                                                onToggleExpansion
                                            }
                                            shareOverride={childCategoryShare(
                                                node.category,
                                                child
                                            )}
                                            shareTitleOverride={`Share of ${node.category.categoryName}`}
                                            summary={summary}
                                            timezone={timezone}
                                        />
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function CategoryPanel({
    expandedRows,
    onToggleExpansion,
    summary,
    timezone
}: {
    readonly expandedRows?: ReadonlySet<string>;
    readonly onToggleExpansion?: (key: string) => void;
    readonly summary: DashboardSummary;
    readonly timezone: string;
}) {
    const incomeCategories = useMemo(
        () => buildDashboardCategoryNodes(summary, 'income'),
        [summary]
    );
    const expenseCategories = useMemo(
        () => buildDashboardCategoryNodes(summary, 'expense'),
        [summary]
    );
    const [localExpandedRows, setLocalExpandedRows] = useState<
        ReadonlySet<string>
    >(new Set());
    const summaryKey = `${summary.period}:${String(summary.from)}:${String(
        summary.to
    )}:${summary.currency}`;
    const effectiveExpandedRows = expandedRows ?? localExpandedRows;

    useEffect(() => {
        void summaryKey;
        if (!expandedRows) {
            setLocalExpandedRows(new Set());
        }
    }, [expandedRows, summaryKey]);

    function toggleLocalExpansion(key: string) {
        setLocalExpandedRows(current => {
            const next = new Set(current);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }

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
                        expandedRows={effectiveExpandedRows}
                        nodes={incomeCategories}
                        onToggleExpansion={
                            onToggleExpansion ?? toggleLocalExpansion
                        }
                        summary={summary}
                        timezone={timezone}
                        title="Income"
                    />
                    <CategoryGroup
                        expandedRows={effectiveExpandedRows}
                        nodes={expenseCategories}
                        onToggleExpansion={
                            onToggleExpansion ?? toggleLocalExpansion
                        }
                        summary={summary}
                        timezone={timezone}
                        title="Expenses"
                    />
                </div>
            </CardContent>
        </Card>
    );
}

export function DashboardPeriodPanel({
    expandedRows,
    onToggleExpansion,
    summary,
    timezone
}: {
    readonly expandedRows?: ReadonlySet<string>;
    readonly onToggleExpansion?: (key: string) => void;
    readonly summary: DashboardSummary;
    readonly timezone: string;
}) {
    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <DashboardSummaryCards summary={summary} timezone={timezone} />
            <CategoryPanel
                expandedRows={expandedRows}
                onToggleExpansion={onToggleExpansion}
                summary={summary}
                timezone={timezone}
            />
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
    favoriteCurrencies,
    initialDate,
    initialPeriod,
    initialWindow,
    selectedCurrency,
    transactionTags,
    vendors,
    timezone,
    transactionCurrencies
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly favoriteCurrencies: readonly string[];
    readonly initialDate: string;
    readonly initialPeriod: DashboardPeriod;
    readonly initialWindow: DashboardWindowResponse;
    readonly selectedCurrency: string;
    readonly transactionTags: readonly TransactionTag[];
    readonly vendors: readonly Vendor[];
    readonly timezone: string;
    readonly transactionCurrencies: readonly string[];
}) {
    const [expandedRowsBySummaryKey, setExpandedRowsBySummaryKey] =
        useState<ExpandedRowsBySummaryKey>({});
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
            ...dashboardBaseWindowQueryParams,
            ...navigationQueryParams
        }),
        [navigationQueryParams]
    );

    function toggleExpansionRow(summaryKey: string, key: string) {
        setExpandedRowsBySummaryKey(current => {
            const nextKeys = new Set(current[summaryKey] ?? []);
            if (nextKeys.has(key)) {
                nextKeys.delete(key);
            } else {
                nextKeys.add(key);
            }
            return { ...current, [summaryKey]: Array.from(nextKeys) };
        });
    }

    function setExpansionRows(summaryKey: string, keys: readonly string[]) {
        setExpandedRowsBySummaryKey(current => ({
            ...current,
            [summaryKey]: [...keys]
        }));
    }

    function expansionActionFor(
        summary: DashboardSummary
    ): DashboardViewExpansionAction | undefined {
        const expansion = dashboardCategoryExpansionState(
            summary,
            expandedRowsBySummaryKey
        );
        if (expansion.expandableKeys.length === 0) {
            return undefined;
        }

        return {
            allExpanded: expansion.allExpanded,
            onToggle: () => {
                setExpansionRows(
                    expansion.summaryKey,
                    expansion.allExpanded ? [] : expansion.expandableKeys
                );
            }
        };
    }

    return (
        <DashboardWindowExplorer
            basePath="/dashboard"
            initialDate={initialDate}
            initialPeriod={initialPeriod}
            initialWindow={initialWindow}
            navigationQueryParams={navigationQueryParams}
            renderBody={({ item }) => {
                const expansion = dashboardCategoryExpansionState(
                    item.summary,
                    expandedRowsBySummaryKey
                );
                return (
                    <DashboardPeriodPanel
                        expandedRows={expansion.expandedRows}
                        onToggleExpansion={key =>
                            toggleExpansionRow(expansion.summaryKey, key)
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
                            <h1 className="text-2xl font-semibold">
                                Dashboard
                            </h1>
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
                                basePath="/dashboard"
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
            skeleton={<DashboardPeriodPanelSkeleton />}
            timezone={timezone}
            windowQueryParams={windowQueryParams}
        />
    );
}
