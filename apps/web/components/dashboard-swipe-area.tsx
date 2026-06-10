'use client';

import { cn } from '@xpenser/ui';
import { useRouter } from 'next/navigation';
import {
    type MouseEvent,
    type PointerEvent,
    type ReactNode,
    useCallback,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import {
    addDashboardPeriod,
    type DashboardPeriod,
    dateParam,
    isLatestDashboardPeriod,
    parseDateParam,
    periodHref
} from '@/lib/dashboard-periods';

type PointerPoint = {
    readonly x: number;
    readonly y: number;
};

const maxCachedPanels = 8;
const transitionMs = 180;
const panelCache = new Map<string, ReactNode>();

function cachePanel(key: string, panel: ReactNode) {
    panelCache.delete(key);
    panelCache.set(key, panel);

    while (panelCache.size > maxCachedPanels) {
        const oldest = panelCache.keys().next().value;
        if (!oldest) {
            return;
        }
        panelCache.delete(oldest);
    }
}

function DashboardPanelSkeleton() {
    return (
        <div
            aria-hidden
            className="rounded-lg border bg-card text-card-foreground shadow-sm"
        >
            <div className="flex flex-col space-y-1.5 p-6">
                <div className="h-6 w-24 rounded-md bg-muted" />
            </div>
            <div className="p-6 pt-0">
                <div className="flex flex-col gap-4">
                    <div>
                        <div className="mb-2 h-3 w-14 rounded-md bg-muted" />
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
                    <div>
                        <div className="mb-2 h-3 w-16 rounded-md bg-muted" />
                        <div className="flex flex-col divide-y">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto_74px] items-center gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_104px]">
                                <div className="space-y-2">
                                    <div className="h-4 w-32 rounded-md bg-muted" />
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
                                    <div className="h-4 w-20 rounded-md bg-muted" />
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
                </div>
            </div>
        </div>
    );
}

export function DashboardSwipeArea({
    basePath = '/dashboard',
    children,
    className,
    date,
    onNavigate,
    onPreview,
    panelForDate,
    period,
    skeleton,
    timezone
}: {
    readonly basePath?: string;
    readonly children: ReactNode;
    readonly className?: string;
    readonly date: string;
    readonly onNavigate?: (selection: {
        readonly date: string;
        readonly direction: -1 | 1;
        readonly href: string;
    }) => void;
    readonly onPreview?: (date: string) => void;
    readonly panelForDate?: (date: string) => ReactNode | undefined;
    readonly period: DashboardPeriod;
    readonly skeleton?: ReactNode;
    readonly timezone: string;
}) {
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);
    const capturedPointerId = useRef<number | null>(null);
    const pointerStart = useRef<PointerPoint | null>(null);
    const didSwipe = useRef(false);
    const committedSwipe = useRef(false);
    const prefetchedHref = useRef<string | null>(null);
    const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [dragDirection, setDragDirection] = useState<-1 | 1 | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const resetKey = `${basePath}:${period}:${date}`;
    const anchorDate = useMemo(
        () => parseDateParam(date, timezone) ?? new Date(),
        [date, timezone]
    );
    const latest = isLatestDashboardPeriod(
        period,
        anchorDate,
        new Date(),
        timezone
    );
    const previousDate = useMemo(
        () => addDashboardPeriod(period, anchorDate, -1, timezone),
        [anchorDate, period, timezone]
    );
    const nextDate = useMemo(
        () => addDashboardPeriod(period, anchorDate, 1, timezone),
        [anchorDate, period, timezone]
    );
    const previousHref = periodHref(basePath, period, previousDate, {
        timeZone: timezone
    });
    const nextHref = latest
        ? undefined
        : periodHref(basePath, period, nextDate, { timeZone: timezone });
    const previousDateParam = dateParam(previousDate, timezone);
    const nextDateParam = dateParam(nextDate, timezone);
    const previousKey = `${basePath}:${period}:${previousDateParam}`;
    const nextKey = `${basePath}:${period}:${nextDateParam}`;
    const targetKey =
        dragDirection === -1 ? nextKey : dragDirection === 1 ? previousKey : '';
    const targetDate =
        dragDirection === -1
            ? nextDateParam
            : dragDirection === 1
              ? previousDateParam
              : '';
    const targetPanel = targetKey ? panelCache.get(targetKey) : undefined;
    const controlledTargetPanel = targetDate
        ? panelForDate?.(targetDate)
        : undefined;
    const canShowTarget = dragDirection === 1 || Boolean(nextHref);

    const viewportWidth = useCallback((): number => {
        return (
            containerRef.current?.getBoundingClientRect().width ??
            window.innerWidth
        );
    }, []);

    useLayoutEffect(() => {
        if (pushTimer.current) {
            clearTimeout(pushTimer.current);
            pushTimer.current = null;
        }

        cachePanel(resetKey, children);
        pointerStart.current = null;
        prefetchedHref.current = null;
        didSwipe.current = false;
        setDragDirection(null);
        if (committedSwipe.current) {
            committedSwipe.current = false;
            setIsDragging(true);
            setSwipeOffset(0);
            requestAnimationFrame(() => {
                setIsDragging(false);
            });
        } else {
            setIsDragging(false);
            setSwipeOffset(0);
        }
        if (!onNavigate) {
            router.prefetch(previousHref);
            if (nextHref) {
                router.prefetch(nextHref);
            }
        }
    }, [children, nextHref, onNavigate, previousHref, resetKey, router]);

    function prefetch(href?: string) {
        if (onNavigate || !href || prefetchedHref.current === href) {
            return;
        }

        prefetchedHref.current = href;
        router.prefetch(href);
    }

    function offsetForSwipe(deltaX: number): number {
        const canNavigate = deltaX > 0 || Boolean(nextHref);
        if (!canNavigate) {
            return Math.max(-48, Math.min(48, deltaX / 3));
        }

        const width = viewportWidth();
        return Math.max(-width, Math.min(width, deltaX));
    }

    function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
        if (pushTimer.current) {
            clearTimeout(pushTimer.current);
            pushTimer.current = null;
            committedSwipe.current = false;
        }

        capturedPointerId.current = null;
        pointerStart.current = { x: event.clientX, y: event.clientY };
        didSwipe.current = false;
        setDragDirection(null);
        setIsDragging(true);
        setSwipeOffset(0);
    }

    function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
        const start = pointerStart.current;
        if (!start) {
            return;
        }

        const deltaX = event.clientX - start.x;
        const deltaY = event.clientY - start.y;

        if (Math.abs(deltaX) < 8 || Math.abs(deltaX) < Math.abs(deltaY)) {
            return;
        }

        if (capturedPointerId.current !== event.pointerId) {
            event.currentTarget.setPointerCapture(event.pointerId);
            capturedPointerId.current = event.pointerId;
        }

        setDragDirection(deltaX < 0 ? -1 : 1);
        setSwipeOffset(offsetForSwipe(deltaX));
        if (Math.abs(deltaX) >= 18) {
            onPreview?.(deltaX < 0 ? nextDateParam : previousDateParam);
            prefetch(deltaX < 0 ? nextHref : previousHref);
        }
    }

    function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
        const start = pointerStart.current;
        if (
            capturedPointerId.current === event.pointerId &&
            event.currentTarget.hasPointerCapture(event.pointerId)
        ) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        capturedPointerId.current = null;
        pointerStart.current = null;
        setIsDragging(false);

        if (!start) {
            setDragDirection(null);
            setSwipeOffset(0);
            return;
        }

        const deltaX = event.clientX - start.x;
        const deltaY = event.clientY - start.y;
        const width = viewportWidth();
        const threshold = Math.min(120, width * 0.25);

        if (
            Math.abs(deltaX) < threshold ||
            Math.abs(deltaX) < Math.abs(deltaY)
        ) {
            setDragDirection(null);
            setSwipeOffset(0);
            return;
        }

        didSwipe.current = true;
        if (deltaX < 0 && nextHref) {
            committedSwipe.current = true;
            setDragDirection(-1);
            setSwipeOffset(-width);
            pushTimer.current = setTimeout(() => {
                if (onNavigate) {
                    onNavigate({
                        date: nextDateParam,
                        direction: -1,
                        href: nextHref
                    });
                } else {
                    router.push(nextHref, { scroll: false });
                }
            }, transitionMs);
        } else if (deltaX > 0) {
            committedSwipe.current = true;
            setDragDirection(1);
            setSwipeOffset(width);
            pushTimer.current = setTimeout(() => {
                if (onNavigate) {
                    onNavigate({
                        date: previousDateParam,
                        direction: 1,
                        href: previousHref
                    });
                } else {
                    router.push(previousHref, { scroll: false });
                }
            }, transitionMs);
        } else {
            setDragDirection(null);
            setSwipeOffset(0);
        }
    }

    function handlePointerCancel() {
        capturedPointerId.current = null;
        pointerStart.current = null;
        setDragDirection(null);
        setIsDragging(false);
        setSwipeOffset(0);
    }

    function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
        if (!didSwipe.current) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        didSwipe.current = false;
    }

    return (
        <div
            className={cn('relative overflow-hidden touch-pan-y', className)}
            data-testid="dashboard-swipe-area"
            onClickCapture={handleClickCapture}
            onPointerCancel={handlePointerCancel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            ref={containerRef}
        >
            <div
                className={`${
                    isDragging
                        ? 'transition-none'
                        : 'transition-transform duration-200 ease-out'
                }`}
                style={{ transform: `translateX(${swipeOffset}px)` }}
            >
                <div className="flex flex-col gap-5 sm:gap-6">{children}</div>
            </div>
            {dragDirection && canShowTarget ? (
                <div
                    aria-hidden
                    className={`pointer-events-none absolute inset-0 ${
                        isDragging
                            ? 'transition-none'
                            : 'transition-transform duration-200 ease-out'
                    }`}
                    style={{
                        transform:
                            dragDirection === -1
                                ? `translateX(calc(${swipeOffset}px + 100%))`
                                : `translateX(calc(${swipeOffset}px - 100%))`
                    }}
                >
                    {controlledTargetPanel ?? targetPanel ?? skeleton ?? (
                        <DashboardPanelSkeleton />
                    )}
                </div>
            ) : null}
        </div>
    );
}
