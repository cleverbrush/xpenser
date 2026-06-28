'use client';

import type {
    Currency,
    DashboardSummary,
    StatsOverview,
    StatsTagReport,
    StatsWindowResponse
} from '@xpenser/contracts';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import { ChevronDownIcon, ChevronRightIcon, ListIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { AmountDisplay } from '@/components/amount-display';
import {
    hiddenAmountLabel,
    useAmountPrivacy
} from '@/components/amount-privacy';
import {
    DashboardPeriodNav,
    type DashboardPeriodSelection
} from '@/components/dashboard-period-nav';
import { DashboardSwipeArea } from '@/components/dashboard-swipe-area';
import { DashboardViewSettingsMenu } from '@/components/dashboard-view-settings-menu';
import { CollapsibleReportCategoryGroup } from '@/components/report-category-group';
import { StatsCharts, StatsChartsSkeleton } from '@/components/stats-charts';
import { categoryTypeLabel } from '@/lib/category-display';
import { categoryTrendHref } from '@/lib/category-trend-query';
import {
    dateParam,
    formatDashboardRangeLabel,
    isDashboardPeriod,
    parseDateParam,
    periodHref
} from '@/lib/dashboard-periods';
import {
    amountClassNameForCategoryTotal,
    amountClassNameForValue,
    formatMoney,
    formatSignedPercent,
    percentChangeClassNameForMetric,
    percentChangeFromPrevious,
    signedCategoryTotal
} from '@/lib/format';
import {
    buildReportCategoryNodes,
    type ReportCategoryNode
} from '@/lib/report-category-tree';
import { transactionExportHref } from '@/lib/transaction-export';

type DashboardPeriod = DashboardSummary['period'];
type StatsWindowItem = StatsWindowResponse['items'][number];
type StatsCategory = StatsOverview['byCategory'][number];
type ReportView = 'categories' | 'overview' | 'tags';
type ReportTagSelection = number | 'untagged' | undefined;
type StatsCache = Partial<
    Record<DashboardPeriod, Record<string, StatsWindowItem>>
>;
type TagReportStatus = 'error' | 'idle' | 'loading';
type TooltipPayload = {
    readonly color?: string;
    readonly name?: string;
    readonly value?: number | string;
};

const reportViews = [
    { id: 'overview', label: 'Overview' },
    { id: 'categories', label: 'Categories' },
    { id: 'tags', label: 'Tags' }
] as const satisfies readonly {
    readonly id: ReportView;
    readonly label: string;
}[];

function parseReportView(value: string | null | undefined): ReportView {
    return value === 'categories' || value === 'tags' ? value : 'overview';
}

function parseReportTag(value: string | null | undefined): ReportTagSelection {
    if (value === 'untagged') {
        return 'untagged';
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function reportTagParam(value: ReportTagSelection): string | undefined {
    return typeof value === 'number' ? String(value) : value;
}

function tagReportKey(
    period: DashboardPeriod,
    date: string,
    tag: ReportTagSelection
): string {
    return `${period}:${date}:${reportTagParam(tag) ?? 'all'}`;
}

function statsCategoryTransactionsHref(
    stats: StatsOverview,
    category: StatsCategory,
    timezone: string
): string {
    const params = new URLSearchParams({
        type: category.type,
        from: dateParam(stats.from, timezone),
        to: dateParam(stats.to, timezone),
        parentCategoryId: String(category.categoryId)
    });
    return `/transactions?${params.toString()}`;
}

function reportHref({
    date,
    period,
    tag,
    timezone,
    view
}: {
    readonly date: string;
    readonly period: DashboardPeriod;
    readonly tag?: ReportTagSelection;
    readonly timezone: string;
    readonly view: ReportView;
}): string {
    const anchor = parseDateParam(date, timezone) ?? new Date();
    const href = periodHref('/stats', period, anchor, {
        cleanDefault: true,
        timeZone: timezone
    });
    const url = new URL(href, 'http://xpenser.local');
    if (view !== 'overview') {
        url.searchParams.set('view', view);
    }
    if (view === 'tags') {
        const tagParam = reportTagParam(tag);
        if (tagParam) {
            url.searchParams.set('tag', tagParam);
        }
    }
    return `${url.pathname}${url.search}`;
}

function tagTransactionsHref({
    from,
    tag,
    timezone,
    to
}: {
    readonly from: Date | string;
    readonly tag: Pick<StatsTagReport['tags'][number], 'kind' | 'tagId'>;
    readonly timezone: string;
    readonly to: Date | string;
}): string {
    const params = new URLSearchParams({
        from: dateParam(new Date(from), timezone),
        to: dateParam(new Date(to), timezone),
        type: 'expense'
    });
    if (tag.kind === 'untagged') {
        params.set('untagged', 'true');
    } else if (tag.tagId !== null) {
        params.append('tagId', String(tag.tagId));
    }
    return `/transactions?${params.toString()}`;
}

function tagCategoryTransactionsHref({
    categoryId,
    detail,
    report,
    timezone
}: {
    readonly categoryId: number;
    readonly detail: NonNullable<StatsTagReport['selectedTag']>;
    readonly report: StatsTagReport;
    readonly timezone: string;
}): string {
    const params = new URLSearchParams({
        from: dateParam(new Date(report.from), timezone),
        parentCategoryId: String(categoryId),
        to: dateParam(new Date(report.to), timezone),
        type: 'expense'
    });
    if (detail.kind === 'untagged') {
        params.set('untagged', 'true');
    } else if (detail.tagId !== null) {
        params.append('tagId', String(detail.tagId));
    }
    return `/transactions?${params.toString()}`;
}

type StatsCategoryNode = ReportCategoryNode<StatsCategory>;

function fallbackStatsParentCategory(
    parentId: number,
    categories: readonly StatsCategory[],
    type: StatsCategory['type'],
    parentName: string
): StatsCategory {
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
        previousPeriodTotal: categories.reduce(
            (sum, category) => sum + category.previousPeriodTotal,
            0
        ),
        previousYearTotal: categories.reduce(
            (sum, category) => sum + category.previousYearTotal,
            0
        ),
        share: 0,
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

function buildStatsCategoryNodes(
    stats: StatsOverview,
    type: StatsCategory['type']
): StatsCategoryNode[] {
    return buildStatsCategoryNodesFromTotals(
        stats.byCategory,
        stats.byParentCategory,
        type
    );
}

function buildStatsCategoryNodesFromTotals(
    categories: readonly StatsCategory[],
    parentCategories: readonly StatsCategory[],
    type: StatsCategory['type']
): StatsCategoryNode[] {
    return buildReportCategoryNodes({
        categories,
        createParentCategory: fallbackStatsParentCategory,
        parentCategories,
        type
    });
}

function statsCategoryRowLabel(
    category: StatsCategory,
    parent?: StatsCategory
): string {
    if (!parent || category.categoryParentId !== null) {
        return category.categoryName;
    }
    return 'General';
}

function formatCountDelta(value: number): string {
    if (value === 0) {
        return '0';
    }
    return `${value > 0 ? '+' : ''}${value}`;
}

function formatPercent(value: number): string {
    return `${value.toLocaleString('en-US', {
        maximumFractionDigits: 1,
        minimumFractionDigits: value > 0 && value < 1 ? 1 : 0
    })}%`;
}

function TagChartTooltip({
    active,
    currency,
    label,
    payload
}: {
    readonly active?: boolean;
    readonly currency: string;
    readonly label?: string | number;
    readonly payload?: readonly TooltipPayload[];
}) {
    const { hideAmounts } = useAmountPrivacy();

    if (!active || !payload?.length) {
        return null;
    }

    return (
        <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-sm">
            <p className="mb-1 font-medium">{label}</p>
            <div className="flex flex-col gap-1">
                {payload.map(item => (
                    <div
                        className="flex items-center justify-between gap-4"
                        key={item.name}
                    >
                        <span style={{ color: item.color }}>{item.name}</span>
                        <span className="font-medium">
                            {typeof item.value === 'number'
                                ? hideAmounts
                                    ? hiddenAmountLabel
                                    : formatMoney(item.value, currency)
                                : item.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function signedComparisonDelta(
    current: number,
    previous: number,
    type: 'expense' | 'income'
): number {
    return type === 'expense' ? previous - current : current - previous;
}

type StatsCard = {
    readonly label: string;
    readonly value: ReactNode;
    readonly className: string;
    readonly previous: number;
    readonly previousYear: number;
    readonly money: boolean;
    readonly previousPercent?: number;
    readonly changeType?: 'expense' | 'income' | 'net';
};

function mergeStatsItems(
    cache: StatsCache,
    period: DashboardPeriod,
    items: readonly StatsWindowItem[],
    replaceExisting = false
): StatsCache {
    const current = cache[period] ?? {};
    let changed = false;
    const nextPeriod = { ...current };

    for (const item of items) {
        if (replaceExisting || !nextPeriod[item.date]) {
            nextPeriod[item.date] = item;
            changed = true;
        }
    }

    return changed ? { ...cache, [period]: nextPeriod } : cache;
}

function initialCache(
    period: DashboardPeriod,
    items: readonly StatsWindowItem[]
): StatsCache {
    return mergeStatsItems({}, period, items, true);
}

function itemDateForAnchor(
    items: readonly StatsWindowItem[],
    date: string,
    timezone: string
): string | undefined {
    const anchor = parseDateParam(date, timezone);
    if (!anchor) {
        return items.find(item => item.date === date)?.date;
    }

    return (
        items.find(item => {
            const from = new Date(item.overview.from);
            const to = new Date(item.overview.to);
            return anchor >= from && anchor <= to;
        })?.date ?? items.find(item => item.date === date)?.date
    );
}

function itemForSelection(
    cache: StatsCache,
    period: DashboardPeriod,
    date: string,
    timezone: string
): StatsWindowItem | undefined {
    const periodItems = cache[period] ?? {};
    return periodItems[
        itemDateForAnchor(Object.values(periodItems), date, timezone) ?? date
    ];
}

export function StatsCards({ stats }: { readonly stats: StatsOverview }) {
    const netDeltaPrevious =
        stats.netTotal - stats.comparison.previousPeriod.netTotal;
    const netDeltaYear =
        stats.netTotal - stats.comparison.previousYear.netTotal;
    const countDeltaPrevious =
        stats.transactionCount -
        stats.comparison.previousPeriod.transactionCount;
    const countDeltaYear =
        stats.transactionCount - stats.comparison.previousYear.transactionCount;

    const cards: StatsCard[] = [
        {
            label: 'Income',
            value: (
                <AmountDisplay
                    currency={stats.currency}
                    value={signedCategoryTotal(stats.incomeTotal, 'income')}
                />
            ),
            className: amountClassNameForCategoryTotal(
                stats.incomeTotal,
                'income'
            ),
            previous: signedComparisonDelta(
                stats.incomeTotal,
                stats.comparison.previousPeriod.incomeTotal,
                'income'
            ),
            previousYear: signedComparisonDelta(
                stats.incomeTotal,
                stats.comparison.previousYear.incomeTotal,
                'income'
            ),
            money: true,
            previousPercent: percentChangeFromPrevious(
                stats.incomeTotal,
                stats.comparison.previousPeriod.incomeTotal
            ),
            changeType: 'income'
        },
        {
            label: 'Expenses',
            value: (
                <AmountDisplay
                    currency={stats.currency}
                    value={signedCategoryTotal(stats.expenseTotal, 'expense')}
                />
            ),
            className: amountClassNameForCategoryTotal(
                stats.expenseTotal,
                'expense'
            ),
            previous: signedComparisonDelta(
                stats.expenseTotal,
                stats.comparison.previousPeriod.expenseTotal,
                'expense'
            ),
            previousYear: signedComparisonDelta(
                stats.expenseTotal,
                stats.comparison.previousYear.expenseTotal,
                'expense'
            ),
            money: true,
            previousPercent: percentChangeFromPrevious(
                stats.expenseTotal,
                stats.comparison.previousPeriod.expenseTotal
            ),
            changeType: 'expense'
        },
        {
            label: 'Net',
            value: (
                <AmountDisplay
                    currency={stats.currency}
                    value={stats.netTotal}
                />
            ),
            className: amountClassNameForValue(stats.netTotal),
            previous: netDeltaPrevious,
            previousYear: netDeltaYear,
            money: true,
            previousPercent: percentChangeFromPrevious(
                stats.netTotal,
                stats.comparison.previousPeriod.netTotal
            ),
            changeType: 'net'
        },
        {
            label: 'Transactions',
            value: String(stats.transactionCount),
            className: '',
            previous: countDeltaPrevious,
            previousYear: countDeltaYear,
            money: false
        }
    ];

    return (
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
            {cards.map(card => (
                <Card className="min-w-0" key={card.label}>
                    <CardHeader className="min-w-0 p-2 sm:p-4">
                        <CardDescription className="truncate text-xs">
                            {card.label}
                        </CardDescription>
                        <CardTitle
                            className={`truncate text-sm sm:text-xl ${card.className}`}
                        >
                            {card.value}
                        </CardTitle>
                        <div className="hidden flex-col gap-1 text-xs text-muted-foreground sm:flex">
                            <span>
                                Previous period:{' '}
                                <span
                                    className={amountClassNameForValue(
                                        card.previous
                                    )}
                                >
                                    {card.money ? (
                                        <AmountDisplay
                                            compact={false}
                                            currency={stats.currency}
                                            value={card.previous}
                                        />
                                    ) : (
                                        formatCountDelta(card.previous)
                                    )}
                                </span>
                                {card.previousPercent !== undefined &&
                                card.changeType ? (
                                    <>
                                        {' '}
                                        <span
                                            className={percentChangeClassNameForMetric(
                                                card.previousPercent,
                                                card.changeType
                                            )}
                                        >
                                            (
                                            {formatSignedPercent(
                                                card.previousPercent
                                            )}
                                            )
                                        </span>
                                    </>
                                ) : null}
                            </span>
                            <span>
                                Previous year:{' '}
                                <span
                                    className={amountClassNameForValue(
                                        card.previousYear
                                    )}
                                >
                                    {card.money ? (
                                        <AmountDisplay
                                            compact={false}
                                            currency={stats.currency}
                                            value={card.previousYear}
                                        />
                                    ) : (
                                        formatCountDelta(card.previousYear)
                                    )}
                                </span>
                            </span>
                        </div>
                    </CardHeader>
                </Card>
            ))}
        </div>
    );
}

function CategoryTrendRow({
    category,
    currency,
    depth = 0,
    expanded = false,
    expandable = false,
    label,
    onToggle,
    href
}: {
    readonly category: StatsCategory;
    readonly currency: string;
    readonly depth?: number;
    readonly expanded?: boolean;
    readonly expandable?: boolean;
    readonly label?: string;
    readonly onToggle?: () => void;
    readonly href: string;
}) {
    const effectiveType = category.type;
    const isChild = depth > 0;

    return (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-sm transition-colors hover:bg-muted/40 sm:px-2">
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
                <Link className="min-w-0" href={href} prefetch={false}>
                    <span className="block truncate font-medium">
                        {label ?? category.categoryDisplayName}
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
                </Link>
            </div>
            <Link
                className={`font-semibold ${amountClassNameForCategoryTotal(
                    category.total,
                    category.type
                )}`}
                href={href}
                prefetch={false}
            >
                <AmountDisplay
                    currency={currency}
                    value={signedCategoryTotal(category.total, category.type)}
                />
            </Link>
        </div>
    );
}

function CategoryTrendPanel({
    stats,
    timezone
}: {
    readonly stats: StatsOverview;
    readonly timezone: string;
}) {
    const incomeCategories = buildStatsCategoryNodes(stats, 'income');
    const expenseCategories = buildStatsCategoryNodes(stats, 'expense');

    if (incomeCategories.length === 0 && expenseCategories.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Category trends</CardTitle>
            </CardHeader>
            <CardContent>
                <div
                    className={
                        incomeCategories.length > 0 &&
                        expenseCategories.length > 0
                            ? 'grid gap-4 md:grid-cols-2'
                            : 'grid gap-4'
                    }
                >
                    {incomeCategories.length > 0 ? (
                        <div>
                            <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                                Income
                            </h3>
                            <CollapsibleReportCategoryGroup
                                empty={null}
                                nodes={incomeCategories}
                                renderChild={({ child, parent }) => (
                                    <CategoryTrendRow
                                        category={child}
                                        currency={stats.currency}
                                        depth={1}
                                        href={categoryTrendHref(
                                            child.categoryId,
                                            {
                                                groupBy: 'month',
                                                range: 'last-12-months'
                                            }
                                        )}
                                        label={statsCategoryRowLabel(
                                            child,
                                            parent
                                        )}
                                    />
                                )}
                                renderParent={({
                                    expandable,
                                    expanded,
                                    node,
                                    onToggle
                                }) => (
                                    <CategoryTrendRow
                                        category={node.category}
                                        currency={stats.currency}
                                        expandable={expandable}
                                        expanded={expanded}
                                        href={
                                            expandable
                                                ? statsCategoryTransactionsHref(
                                                      stats,
                                                      node.category,
                                                      timezone
                                                  )
                                                : categoryTrendHref(
                                                      node.category.categoryId,
                                                      {
                                                          groupBy: 'month',
                                                          range: 'last-12-months'
                                                      }
                                                  )
                                        }
                                        onToggle={onToggle}
                                    />
                                )}
                            />
                        </div>
                    ) : null}
                    {expenseCategories.length > 0 ? (
                        <div>
                            <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                                Expenses
                            </h3>
                            <CollapsibleReportCategoryGroup
                                empty={null}
                                nodes={expenseCategories}
                                renderChild={({ child, parent }) => (
                                    <CategoryTrendRow
                                        category={child}
                                        currency={stats.currency}
                                        depth={1}
                                        href={categoryTrendHref(
                                            child.categoryId,
                                            {
                                                groupBy: 'month',
                                                range: 'last-12-months'
                                            }
                                        )}
                                        label={statsCategoryRowLabel(
                                            child,
                                            parent
                                        )}
                                    />
                                )}
                                renderParent={({
                                    expandable,
                                    expanded,
                                    node,
                                    onToggle
                                }) => (
                                    <CategoryTrendRow
                                        category={node.category}
                                        currency={stats.currency}
                                        expandable={expandable}
                                        expanded={expanded}
                                        href={
                                            expandable
                                                ? statsCategoryTransactionsHref(
                                                      stats,
                                                      node.category,
                                                      timezone
                                                  )
                                                : categoryTrendHref(
                                                      node.category.categoryId,
                                                      {
                                                          groupBy: 'month',
                                                          range: 'last-12-months'
                                                      }
                                                  )
                                        }
                                        onToggle={onToggle}
                                    />
                                )}
                            />
                        </div>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
}

function TagDistributionPanel({
    date,
    report,
    selectedTag,
    timezone
}: {
    readonly date: string;
    readonly report: StatsTagReport;
    readonly selectedTag: ReportTagSelection;
    readonly timezone: string;
}) {
    if (report.tags.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Tag distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        No tagged or untagged expenses in this period.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tag distribution</CardTitle>
                <CardDescription>
                    {report.expenseCount}{' '}
                    {report.expenseCount === 1 ? 'expense' : 'expenses'} ·{' '}
                    <AmountDisplay
                        currency={report.currency}
                        value={-report.expenseTotal}
                    />
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col divide-y">
                    {report.tags.map(tag => {
                        const tagSelection =
                            tag.kind === 'untagged'
                                ? 'untagged'
                                : (tag.tagId ?? undefined);
                        const selected = selectedTag === tagSelection;
                        const transactionsHref = tagTransactionsHref({
                            from: report.from,
                            tag,
                            timezone,
                            to: report.to
                        });
                        return (
                            <div
                                className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                                key={`${tag.kind}:${tag.tagId ?? 'none'}`}
                            >
                                <Link
                                    aria-current={selected ? 'page' : undefined}
                                    className="min-w-0 text-left"
                                    href={reportHref({
                                        date,
                                        period: report.period,
                                        tag: tagSelection,
                                        timezone,
                                        view: 'tags'
                                    })}
                                    prefetch={false}
                                >
                                    <div className="mb-1 flex min-w-0 items-center gap-2">
                                        <span className="truncate font-medium">
                                            {tag.tagName}
                                        </span>
                                        {tag.kind === 'untagged' ? (
                                            <Badge variant="outline">
                                                Untagged
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full rounded-full bg-primary"
                                            style={{
                                                width: `${Math.min(
                                                    tag.share,
                                                    100
                                                )}%`
                                            }}
                                        />
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        {formatPercent(tag.share)} ·{' '}
                                        {tag.transactionCount}{' '}
                                        {tag.transactionCount === 1
                                            ? 'transaction'
                                            : 'transactions'}
                                    </div>
                                </Link>
                                <div className="flex items-center justify-between gap-4 sm:justify-end">
                                    <Link
                                        className={`font-semibold ${amountClassNameForCategoryTotal(
                                            tag.total,
                                            'expense'
                                        )}`}
                                        href={transactionsHref}
                                        prefetch={false}
                                    >
                                        <AmountDisplay
                                            currency={report.currency}
                                            value={-tag.total}
                                        />
                                    </Link>
                                    <Button
                                        asChild
                                        size="icon-xs"
                                        variant="outline"
                                    >
                                        <Link
                                            aria-label={`View ${tag.tagName} transactions`}
                                            href={transactionsHref}
                                            prefetch={false}
                                            title="View transactions"
                                        >
                                            <ListIcon
                                                aria-hidden
                                                className="size-3"
                                            />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

function TagDetailCategoryPanel({
    detail,
    report,
    timezone
}: {
    readonly detail: NonNullable<StatsTagReport['selectedTag']>;
    readonly report: StatsTagReport;
    readonly timezone: string;
}) {
    const categories = buildStatsCategoryNodesFromTotals(
        detail.byCategory,
        detail.byParentCategory,
        'expense'
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Category structure</CardTitle>
            </CardHeader>
            <CardContent>
                <CollapsibleReportCategoryGroup
                    empty={
                        <p className="text-sm text-muted-foreground">
                            No category totals.
                        </p>
                    }
                    nodes={categories}
                    renderChild={({ child, parent }) => (
                        <CategoryTrendRow
                            category={child}
                            currency={report.currency}
                            depth={1}
                            href={tagCategoryTransactionsHref({
                                categoryId: child.categoryId,
                                detail,
                                report,
                                timezone
                            })}
                            label={statsCategoryRowLabel(child, parent)}
                        />
                    )}
                    renderParent={({
                        expandable,
                        expanded,
                        node,
                        onToggle
                    }) => (
                        <CategoryTrendRow
                            category={node.category}
                            currency={report.currency}
                            expandable={expandable}
                            expanded={expanded}
                            href={tagCategoryTransactionsHref({
                                categoryId: node.category.categoryId,
                                detail,
                                report,
                                timezone
                            })}
                            onToggle={onToggle}
                        />
                    )}
                />
            </CardContent>
        </Card>
    );
}

function TagDetailPanel({
    detail,
    report,
    timezone
}: {
    readonly detail: NonNullable<StatsTagReport['selectedTag']>;
    readonly report: StatsTagReport;
    readonly timezone: string;
}) {
    const { hideAmounts } = useAmountPrivacy();
    const chartData = detail.trend.map(point => ({
        label: point.label,
        Expenses: point.expenseTotal
    }));

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <CardTitle>{detail.tagName}</CardTitle>
                            <CardDescription>
                                {detail.transactionCount}{' '}
                                {detail.transactionCount === 1
                                    ? 'expense'
                                    : 'expenses'}{' '}
                                · {formatPercent(detail.share)}
                            </CardDescription>
                        </div>
                        <Link
                            className={`font-semibold ${amountClassNameForCategoryTotal(
                                detail.total,
                                'expense'
                            )}`}
                            href={tagTransactionsHref({
                                from: report.from,
                                tag: detail,
                                timezone,
                                to: report.to
                            })}
                            prefetch={false}
                        >
                            <AmountDisplay
                                currency={report.currency}
                                value={-detail.total}
                            />
                        </Link>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-64">
                        <ResponsiveContainer height="100%" width="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid
                                    stroke="hsl(var(--border))"
                                    strokeDasharray="3 3"
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="label"
                                    fontSize={12}
                                    stroke="hsl(var(--muted-foreground))"
                                    tickLine={false}
                                />
                                <YAxis
                                    fontSize={12}
                                    stroke="hsl(var(--muted-foreground))"
                                    tickFormatter={value =>
                                        hideAmounts
                                            ? hiddenAmountLabel
                                            : Number(value).toLocaleString(
                                                  'en-US',
                                                  {
                                                      maximumFractionDigits: 0
                                                  }
                                              )
                                    }
                                    tickLine={false}
                                    width={48}
                                />
                                <Tooltip
                                    content={
                                        <TagChartTooltip
                                            currency={report.currency}
                                        />
                                    }
                                />
                                <Bar
                                    dataKey="Expenses"
                                    fill="hsl(var(--primary))"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
                <TagDetailCategoryPanel
                    detail={detail}
                    report={report}
                    timezone={timezone}
                />
                <Card>
                    <CardHeader>
                        <CardTitle>Top vendors</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {detail.topVendors.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No vendors.
                            </p>
                        ) : (
                            <div className="flex flex-col divide-y">
                                {detail.topVendors.map(vendor => (
                                    <div
                                        className="flex items-center justify-between gap-3 py-3 text-sm"
                                        key={vendor.vendorId ?? 'none'}
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">
                                                {vendor.vendorName}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {vendor.transactionCount}{' '}
                                                {vendor.transactionCount === 1
                                                    ? 'transaction'
                                                    : 'transactions'}
                                            </p>
                                        </div>
                                        <span
                                            className={`font-semibold ${amountClassNameForCategoryTotal(
                                                vendor.total,
                                                'expense'
                                            )}`}
                                        >
                                            <AmountDisplay
                                                currency={report.currency}
                                                value={-vendor.total}
                                            />
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatsTagReportPanel({
    date,
    report,
    selectedTag,
    status,
    timezone
}: {
    readonly date: string;
    readonly report: StatsTagReport | null;
    readonly selectedTag: ReportTagSelection;
    readonly status: TagReportStatus;
    readonly timezone: string;
}) {
    if (status === 'loading' && !report) {
        return (
            <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
                Loading tag report...
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="rounded-md border bg-card p-4 text-sm text-destructive">
                Could not load tag report.
            </div>
        );
    }

    if (!report) {
        return null;
    }

    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
            <TagDistributionPanel
                date={date}
                report={report}
                selectedTag={selectedTag}
                timezone={timezone}
            />
            {report.selectedTag ? (
                <TagDetailPanel
                    detail={report.selectedTag}
                    report={report}
                    timezone={timezone}
                />
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Selected tag</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            No tag selected.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export function StatsExplorer({
    currencies,
    defaultCurrency,
    favoriteCurrencies,
    initialDate,
    initialPeriod,
    initialTag,
    initialTagReport,
    initialView,
    initialWindow,
    timezone
}: {
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly favoriteCurrencies: readonly string[];
    readonly initialDate: string;
    readonly initialPeriod: DashboardPeriod;
    readonly initialTag: ReportTagSelection;
    readonly initialTagReport: StatsTagReport | null;
    readonly initialView: ReportView;
    readonly initialWindow: StatsWindowResponse;
    readonly timezone: string;
}) {
    const router = useRouter();
    const pendingFetches = useRef(new Set<string>());
    const [cache, setCache] = useState(() =>
        initialCache(initialPeriod, initialWindow.items)
    );
    const [selection, setSelection] = useState({
        date: initialDate,
        period: initialPeriod,
        tag: initialTag,
        view: initialView
    });
    const initialTagReportKey =
        initialTagReport && initialView === 'tags'
            ? tagReportKey(initialPeriod, initialDate, initialTag)
            : '';
    const [tagReport, setTagReport] = useState<StatsTagReport | null>(
        initialTagReport
    );
    const [tagReportStatus, setTagReportStatus] =
        useState<TagReportStatus>('idle');
    const [tagReportCacheKey, setTagReportCacheKey] =
        useState(initialTagReportKey);
    const currentItem = itemForSelection(
        cache,
        selection.period,
        selection.date,
        timezone
    );
    const currentDate = currentItem?.date ?? selection.date;

    useEffect(() => {
        setCache(current =>
            mergeStatsItems(current, initialPeriod, initialWindow.items, true)
        );
        setSelection({
            date: initialDate,
            period: initialPeriod,
            tag: initialTag,
            view: initialView
        });
        setTagReport(initialTagReport);
        setTagReportCacheKey(initialTagReportKey);
    }, [
        initialDate,
        initialPeriod,
        initialTag,
        initialTagReport,
        initialTagReportKey,
        initialView,
        initialWindow
    ]);

    const commitSelection = useCallback(
        (
            period: DashboardPeriod,
            date: string,
            pushHistory = true,
            view = selection.view,
            tag = selection.tag
        ) => {
            const nextTag = view === 'tags' ? tag : undefined;
            const href = reportHref({
                date,
                period,
                tag: nextTag,
                timezone,
                view
            });
            setSelection({ date, period, tag: nextTag, view });
            if (pushHistory) {
                window.history.pushState(null, '', href);
            }
        },
        [selection.tag, selection.view, timezone]
    );

    const fetchWindow = useCallback(
        async (
            period: DashboardPeriod,
            date: string,
            before = 2,
            after = 2
        ): Promise<readonly StatsWindowItem[]> => {
            const requestKey = `${period}:${date}:${before}:${after}`;
            if (pendingFetches.current.has(requestKey)) {
                return [];
            }

            pendingFetches.current.add(requestKey);
            const params = new URLSearchParams({
                after: String(after),
                before: String(before),
                date,
                period
            });

            try {
                const response = await fetch(
                    `/app-api/stats/window?${params.toString()}`,
                    { headers: { Accept: 'application/json' } }
                );
                if (response.status === 401) {
                    router.push('/auth/session-expired');
                    return [];
                }
                if (!response.ok) {
                    throw new Error('Could not load report periods.');
                }

                const periodWindow =
                    (await response.json()) as StatsWindowResponse;
                setCache(current =>
                    mergeStatsItems(current, period, periodWindow.items)
                );
                return periodWindow.items;
            } finally {
                pendingFetches.current.delete(requestKey);
            }
        },
        [router]
    );

    const fetchTagReport = useCallback(
        async (
            period: DashboardPeriod,
            date: string,
            tag: ReportTagSelection
        ) => {
            const requestKey = tagReportKey(period, date, tag);
            const params = new URLSearchParams({ date, period });
            const tagParam = reportTagParam(tag);
            if (tagParam) {
                params.set('tag', tagParam);
            }

            setTagReportStatus('loading');
            try {
                const response = await fetch(
                    `/app-api/stats/tags?${params.toString()}`,
                    { headers: { Accept: 'application/json' } }
                );
                if (response.status === 401) {
                    router.push('/auth/session-expired');
                    return;
                }
                if (!response.ok) {
                    throw new Error('Could not load tag report.');
                }

                setTagReport((await response.json()) as StatsTagReport);
                setTagReportCacheKey(requestKey);
                setTagReportStatus('idle');
            } catch {
                setTagReportStatus('error');
            }
        },
        [router]
    );

    const navigateTo = useCallback(
        async (
            next: DashboardPeriodSelection & {
                readonly tag?: ReportTagSelection;
                readonly view?: ReportView;
            },
            pushHistory = true
        ) => {
            const nextView = next.view ?? selection.view;
            const nextTag = next.tag ?? selection.tag;
            const cached = itemForSelection(
                cache,
                next.period,
                next.date,
                timezone
            );
            if (cached) {
                commitSelection(
                    next.period,
                    cached.date,
                    pushHistory,
                    nextView,
                    nextTag
                );
                return;
            }

            let items: readonly StatsWindowItem[];
            try {
                items = await fetchWindow(next.period, next.date);
            } catch {
                router.push(next.href, { scroll: false });
                return;
            }

            const loadedDate = itemDateForAnchor(items, next.date, timezone);
            if (loadedDate) {
                commitSelection(
                    next.period,
                    loadedDate,
                    pushHistory,
                    nextView,
                    nextTag
                );
            } else {
                router.push(next.href, { scroll: false });
            }
        },
        [
            cache,
            commitSelection,
            fetchWindow,
            router,
            selection.tag,
            selection.view,
            timezone
        ]
    );

    const navigateSwipe = useCallback(
        (next: { readonly date: string; readonly href: string }) => {
            const cached = itemForSelection(
                cache,
                selection.period,
                next.date,
                timezone
            );
            if (cached) {
                commitSelection(selection.period, cached.date);
                return;
            }

            router.push(next.href, { scroll: false });
        },
        [cache, commitSelection, router, selection.period, timezone]
    );

    const previewDate = useCallback(
        (date: string) => {
            const cached = itemForSelection(
                cache,
                selection.period,
                date,
                timezone
            );
            if (!cached) {
                void fetchWindow(selection.period, date).catch(() => undefined);
            }
        },
        [cache, fetchWindow, selection.period, timezone]
    );

    useEffect(() => {
        const periodItems = cache[selection.period] ?? {};
        const dates = Object.keys(periodItems).sort();
        const index = dates.indexOf(currentDate);
        if (index === -1) {
            return;
        }

        if (index <= 1) {
            void fetchWindow(selection.period, currentDate, 2, 0).catch(
                () => undefined
            );
        }
        if (dates.length - index <= 2) {
            void fetchWindow(selection.period, currentDate, 0, 2).catch(
                () => undefined
            );
        }
    }, [cache, currentDate, fetchWindow, selection.period]);

    useEffect(() => {
        if (selection.view !== 'tags') {
            return;
        }

        const key = tagReportKey(selection.period, currentDate, selection.tag);
        if (tagReportCacheKey === key && tagReport) {
            return;
        }

        void fetchTagReport(selection.period, currentDate, selection.tag).catch(
            () => undefined
        );
    }, [
        currentDate,
        fetchTagReport,
        selection.period,
        selection.tag,
        selection.view,
        tagReport,
        tagReportCacheKey
    ]);

    useEffect(() => {
        function handlePopState() {
            const params = new URLSearchParams(window.location.search);
            const periodParam = params.get('period') ?? undefined;
            const date = params.get('date');
            void navigateTo(
                {
                    date: date ?? dateParam(new Date(), timezone),
                    href: window.location.href,
                    period: isDashboardPeriod(periodParam)
                        ? periodParam
                        : 'day',
                    tag: parseReportTag(params.get('tag')),
                    view: parseReportView(params.get('view'))
                },
                false
            );
        }

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [navigateTo, timezone]);

    const selectView = useCallback(
        (view: ReportView) => {
            commitSelection(
                selection.period,
                currentDate,
                true,
                view,
                view === 'tags' ? selection.tag : undefined
            );
        },
        [commitSelection, currentDate, selection.period, selection.tag]
    );

    const panelForDate = useCallback(
        (date: string) => {
            const item = itemForSelection(
                cache,
                selection.period,
                date,
                timezone
            );
            return item ? <StatsCharts stats={item.overview} /> : undefined;
        },
        [cache, selection.period, timezone]
    );

    const statsPanel = useMemo(
        () =>
            currentItem ? <StatsCharts stats={currentItem.overview} /> : null,
        [currentItem]
    );

    if (!currentItem || !statsPanel) {
        return null;
    }

    const stats = currentItem.overview;
    const exportParams =
        selection.view === 'tags' && selection.tag === 'untagged'
            ? { type: 'expense', untagged: 'true' }
            : selection.view === 'tags' && typeof selection.tag === 'number'
              ? { type: 'expense', tagId: String(selection.tag) }
              : undefined;

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold">Reports</h1>
                    <p className="text-sm text-muted-foreground">
                        {formatDashboardRangeLabel({
                            from: stats.from,
                            period: selection.period,
                            to: stats.to,
                            timeZone: timezone
                        })}{' '}
                        in {stats.currency}.
                    </p>
                </div>
                <DashboardViewSettingsMenu
                    basePath="/stats"
                    currencies={currencies}
                    currentDate={currentDate}
                    defaultCurrency={defaultCurrency}
                    exportAction={{
                        href: transactionExportHref({
                            extraParams: exportParams,
                            from: stats.from,
                            timezone,
                            to: stats.to
                        })
                    }}
                    favoriteCurrencies={favoriteCurrencies}
                    period={selection.period}
                    selectedCurrency={defaultCurrency}
                    showCurrencySelector={false}
                    timezone={timezone}
                />
            </div>

            <DashboardPeriodNav
                basePath="/stats"
                date={currentDate}
                onNavigate={selection => {
                    void navigateTo(selection);
                }}
                period={selection.period}
                timezone={timezone}
            />

            <div
                aria-label="Report views"
                className="grid grid-cols-3 gap-1 rounded-md border bg-muted p-1"
                role="tablist"
            >
                {reportViews.map(view => (
                    <button
                        aria-selected={selection.view === view.id}
                        className={`rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
                            selection.view === view.id
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                        }`}
                        key={view.id}
                        onClick={() => {
                            selectView(view.id);
                        }}
                        role="tab"
                        type="button"
                    >
                        {view.label}
                    </button>
                ))}
            </div>

            {selection.view === 'overview' ? (
                <>
                    <StatsCards stats={stats} />
                    <DashboardSwipeArea
                        basePath="/stats"
                        date={currentDate}
                        onNavigate={navigateSwipe}
                        onPreview={previewDate}
                        panelForDate={panelForDate}
                        period={selection.period}
                        skeleton={<StatsChartsSkeleton />}
                        timezone={timezone}
                    >
                        {statsPanel}
                    </DashboardSwipeArea>
                </>
            ) : null}

            {selection.view === 'categories' ? (
                <CategoryTrendPanel stats={stats} timezone={timezone} />
            ) : null}

            {selection.view === 'tags' ? (
                <StatsTagReportPanel
                    date={currentDate}
                    report={tagReport}
                    selectedTag={selection.tag}
                    status={tagReportStatus}
                    timezone={timezone}
                />
            ) : null}
        </div>
    );
}
