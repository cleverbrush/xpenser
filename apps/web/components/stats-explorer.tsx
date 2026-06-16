'use client';

import type {
    DashboardSummary,
    StatsOverview,
    StatsWindowResponse
} from '@xpenser/contracts';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import {
    ChevronDownIcon,
    ChevronRightIcon,
    TrendingUpIcon
} from 'lucide-react';
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
import { AmountDisplay } from '@/components/amount-display';
import {
    DashboardPeriodNav,
    type DashboardPeriodSelection
} from '@/components/dashboard-period-nav';
import { DashboardSwipeArea } from '@/components/dashboard-swipe-area';
import { CollapsibleReportCategoryGroup } from '@/components/report-category-group';
import { StatsCharts, StatsChartsSkeleton } from '@/components/stats-charts';
import { categoryTypeLabel } from '@/lib/category-display';
import { categoryTrendHref } from '@/lib/category-trend-query';
import {
    dateParam,
    formatDashboardRangeLabel,
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

type DashboardPeriod = DashboardSummary['period'];
type StatsWindowItem = StatsWindowResponse['items'][number];
type StatsCategory = StatsOverview['byCategory'][number];
type StatsCache = Partial<
    Record<DashboardPeriod, Record<string, StatsWindowItem>>
>;

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
    return buildReportCategoryNodes({
        categories: stats.byCategory,
        createParentCategory: fallbackStatsParentCategory,
        parentCategories: stats.byParentCategory,
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
                                    {card.money
                                        ? formatMoney(
                                              card.previous,
                                              stats.currency
                                          )
                                        : formatCountDelta(card.previous)}
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
                                    {card.money
                                        ? formatMoney(
                                              card.previousYear,
                                              stats.currency
                                          )
                                        : formatCountDelta(card.previousYear)}
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

export function StatsExplorer({
    initialDate,
    initialPeriod,
    initialWindow,
    timezone
}: {
    readonly initialDate: string;
    readonly initialPeriod: DashboardPeriod;
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
        period: initialPeriod
    });
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
        setSelection({ date: initialDate, period: initialPeriod });
    }, [initialDate, initialPeriod, initialWindow]);

    const commitSelection = useCallback(
        (period: DashboardPeriod, date: string, pushHistory = true) => {
            const anchor = parseDateParam(date, timezone) ?? new Date();
            const href = periodHref('/stats', period, anchor, {
                cleanDefault: true,
                timeZone: timezone
            });
            setSelection({ date, period });
            if (pushHistory) {
                window.history.pushState(null, '', href);
            }
        },
        [timezone]
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
                    `/api/stats/window?${params.toString()}`,
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

    const navigateTo = useCallback(
        async (next: DashboardPeriodSelection, pushHistory = true) => {
            const cached = itemForSelection(
                cache,
                next.period,
                next.date,
                timezone
            );
            if (cached) {
                commitSelection(next.period, cached.date, pushHistory);
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
                commitSelection(next.period, loadedDate, pushHistory);
            } else {
                router.push(next.href, { scroll: false });
            }
        },
        [cache, commitSelection, fetchWindow, router, timezone]
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
        function handlePopState() {
            const params = new URLSearchParams(window.location.search);
            const period = params.get('period') as DashboardPeriod | null;
            const date = params.get('date');
            if (period && date) {
                void navigateTo(
                    { date, href: window.location.href, period },
                    false
                );
            } else {
                void navigateTo(
                    {
                        date: dateParam(new Date(), timezone),
                        href: '/stats',
                        period: 'day'
                    },
                    false
                );
            }
        }

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [navigateTo, timezone]);

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

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
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
                <Button asChild className="w-fit" size="sm" variant="outline">
                    <Link href="/stats/forecast">
                        <TrendingUpIcon aria-hidden className="size-4" />
                        Forecast
                    </Link>
                </Button>
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

            <StatsCards stats={stats} />

            <CategoryTrendPanel stats={stats} timezone={timezone} />

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
        </div>
    );
}
