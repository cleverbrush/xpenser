'use client';

import type {
    DashboardSummary,
    DashboardWindowResponse
} from '@xpenser/contracts';
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
    DashboardPeriodNav,
    type DashboardPeriodSelection
} from '@/components/dashboard-period-nav';
import { DashboardSwipeArea } from '@/components/dashboard-swipe-area';
import { dateParam, parseDateParam, periodHref } from '@/lib/dashboard-periods';
import { dashboardWindowItemDateForAnchor } from '@/lib/dashboard-window';

type DashboardPeriod = DashboardSummary['period'];
type DashboardWindowItem = DashboardWindowResponse['items'][number];
type DashboardCache = Partial<
    Record<DashboardPeriod, Record<string, DashboardWindowItem>>
>;
type DashboardWindowExplorerContext = {
    readonly currentDate: string;
    readonly item: DashboardWindowItem;
    readonly period: DashboardPeriod;
};
type ExtraQueryParams = Readonly<Record<string, number | string>>;
type NavigationQueryParams = Readonly<Record<string, string | undefined>>;
const emptyQueryParams: ExtraQueryParams = {};
const emptyNavigationQueryParams: NavigationQueryParams = {};

function mergeDashboardItems(
    cache: DashboardCache,
    period: DashboardPeriod,
    items: readonly DashboardWindowItem[],
    replaceExisting = false
): DashboardCache {
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
    items: readonly DashboardWindowItem[]
): DashboardCache {
    return mergeDashboardItems({}, period, items, true);
}

function itemForSelection(
    cache: DashboardCache,
    period: DashboardPeriod,
    date: string,
    timezone: string
): DashboardWindowItem | undefined {
    const periodItems = cache[period] ?? {};
    return periodItems[
        dashboardWindowItemDateForAnchor(
            Object.values(periodItems),
            date,
            timezone
        ) ?? date
    ];
}

export function DashboardWindowExplorer({
    basePath,
    initialDate,
    initialPeriod,
    initialWindow,
    navigationQueryParams = emptyNavigationQueryParams,
    renderBody,
    renderHeader,
    skeleton,
    timezone,
    windowQueryParams = emptyQueryParams
}: {
    readonly basePath: string;
    readonly initialDate: string;
    readonly initialPeriod: DashboardPeriod;
    readonly initialWindow: DashboardWindowResponse;
    readonly navigationQueryParams?: NavigationQueryParams;
    readonly renderBody: (context: DashboardWindowExplorerContext) => ReactNode;
    readonly renderHeader: (
        context: DashboardWindowExplorerContext
    ) => ReactNode;
    readonly skeleton: ReactNode;
    readonly timezone: string;
    readonly windowQueryParams?: ExtraQueryParams;
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
    const queryKey = JSON.stringify(windowQueryParams);

    useEffect(() => {
        void queryKey;
        setCache(initialCache(initialPeriod, initialWindow.items));
        setSelection({ date: initialDate, period: initialPeriod });
    }, [initialDate, initialPeriod, initialWindow, queryKey]);

    const commitSelection = useCallback(
        (period: DashboardPeriod, date: string, pushHistory = true) => {
            const anchor = parseDateParam(date, timezone) ?? new Date();
            const href = periodHref(basePath, period, anchor, {
                cleanDefault: true,
                extraParams: navigationQueryParams,
                timeZone: timezone
            });
            setSelection({ date, period });
            if (pushHistory) {
                window.history.pushState(null, '', href);
            }
        },
        [basePath, navigationQueryParams, timezone]
    );

    const fetchWindow = useCallback(
        async (
            period: DashboardPeriod,
            date: string,
            before = 2,
            after = 2
        ): Promise<readonly DashboardWindowItem[]> => {
            const requestKey = `${period}:${date}:${before}:${after}:${queryKey}`;
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
            for (const [key, value] of Object.entries(windowQueryParams)) {
                params.set(key, String(value));
            }

            try {
                const response = await fetch(
                    `/app-api/dashboard/window?${params.toString()}`,
                    { headers: { Accept: 'application/json' } }
                );
                if (response.status === 401) {
                    router.push('/auth/session-expired');
                    return [];
                }
                if (!response.ok) {
                    throw new Error('Could not load dashboard periods.');
                }

                const periodWindow =
                    (await response.json()) as DashboardWindowResponse;
                setCache(current =>
                    mergeDashboardItems(current, period, periodWindow.items)
                );
                return periodWindow.items;
            } finally {
                pendingFetches.current.delete(requestKey);
            }
        },
        [queryKey, router, windowQueryParams]
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

            let items: readonly DashboardWindowItem[];
            try {
                items = await fetchWindow(next.period, next.date);
            } catch {
                router.push(next.href, { scroll: false });
                return;
            }

            const loadedDate = dashboardWindowItemDateForAnchor(
                items,
                next.date,
                timezone
            );
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
                        href: basePath,
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
    }, [basePath, navigateTo, timezone]);

    const panelForDate = useCallback(
        (date: string) => {
            const item = itemForSelection(
                cache,
                selection.period,
                date,
                timezone
            );
            return item
                ? renderBody({
                      currentDate: item.date,
                      item,
                      period: selection.period
                  })
                : undefined;
        },
        [cache, renderBody, selection.period, timezone]
    );

    const currentContext = useMemo(
        () =>
            currentItem
                ? {
                      currentDate,
                      item: currentItem,
                      period: selection.period
                  }
                : undefined,
        [currentDate, currentItem, selection.period]
    );

    const currentPanel = currentContext ? renderBody(currentContext) : null;

    if (!currentContext || !currentPanel) {
        return null;
    }

    return (
        <div className="flex min-h-[calc(100dvh-11rem)] flex-col gap-5 sm:min-h-[calc(100dvh-9.5rem)] sm:gap-6">
            {renderHeader(currentContext)}
            <DashboardPeriodNav
                basePath={basePath}
                date={currentDate}
                extraQueryParams={navigationQueryParams}
                onNavigate={selection => {
                    void navigateTo(selection);
                }}
                period={selection.period}
                timezone={timezone}
            />
            <DashboardSwipeArea
                basePath={basePath}
                className="min-h-64 flex-1"
                date={currentDate}
                extraQueryParams={navigationQueryParams}
                onNavigate={navigateSwipe}
                onPreview={previewDate}
                panelForDate={panelForDate}
                period={selection.period}
                skeleton={skeleton}
                timezone={timezone}
            >
                {currentPanel}
            </DashboardSwipeArea>
        </div>
    );
}
