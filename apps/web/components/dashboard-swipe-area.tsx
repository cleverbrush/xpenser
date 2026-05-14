'use client';

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
    dashboardHref,
    dateParam,
    isLatestDashboardPeriod,
    parseDateParam
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
        <div aria-hidden className="flex flex-col gap-5 sm:gap-6">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                    <div className="h-7 w-36 rounded-md bg-muted" />
                    <div className="h-4 w-28 rounded-md bg-muted" />
                </div>
                <div className="h-9 w-16 rounded-md bg-muted" />
            </div>
            <div className="h-10 rounded-md bg-muted" />
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="h-20 rounded-md border bg-card" />
                <div className="h-20 rounded-md border bg-card" />
                <div className="h-20 rounded-md border bg-card" />
            </div>
            <div className="space-y-3 rounded-md border bg-card p-4">
                <div className="h-5 w-24 rounded-md bg-muted" />
                <div className="h-12 rounded-md bg-muted" />
                <div className="h-12 rounded-md bg-muted" />
                <div className="h-12 rounded-md bg-muted" />
            </div>
        </div>
    );
}

export function DashboardSwipeArea({
    children,
    date,
    period
}: {
    readonly children: ReactNode;
    readonly date: string;
    readonly period: DashboardPeriod;
}) {
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);
    const pointerStart = useRef<PointerPoint | null>(null);
    const didSwipe = useRef(false);
    const committedSwipe = useRef(false);
    const prefetchedHref = useRef<string | null>(null);
    const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [dragDirection, setDragDirection] = useState<-1 | 1 | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const resetKey = `${period}:${date}`;
    const anchorDate = useMemo(
        () => parseDateParam(date) ?? new Date(),
        [date]
    );
    const latest = isLatestDashboardPeriod(period, anchorDate);
    const previousDate = useMemo(
        () => addDashboardPeriod(period, anchorDate, -1),
        [anchorDate, period]
    );
    const nextDate = useMemo(
        () => addDashboardPeriod(period, anchorDate, 1),
        [anchorDate, period]
    );
    const previousHref = dashboardHref(period, previousDate);
    const nextHref = latest ? undefined : dashboardHref(period, nextDate);
    const previousKey = `${period}:${dateParam(previousDate)}`;
    const nextKey = `${period}:${dateParam(nextDate)}`;
    const targetKey =
        dragDirection === -1 ? nextKey : dragDirection === 1 ? previousKey : '';
    const targetPanel = targetKey ? panelCache.get(targetKey) : undefined;
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
        router.prefetch(previousHref);
        if (nextHref) {
            router.prefetch(nextHref);
        }
    }, [children, nextHref, previousHref, resetKey, router]);

    function prefetch(href?: string) {
        if (!href || prefetchedHref.current === href) {
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

        pointerStart.current = { x: event.clientX, y: event.clientY };
        didSwipe.current = false;
        setDragDirection(null);
        setIsDragging(true);
        setSwipeOffset(0);
        event.currentTarget.setPointerCapture(event.pointerId);
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

        setDragDirection(deltaX < 0 ? -1 : 1);
        setSwipeOffset(offsetForSwipe(deltaX));
        if (Math.abs(deltaX) >= 18) {
            prefetch(deltaX < 0 ? nextHref : previousHref);
        }
    }

    function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
        const start = pointerStart.current;
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
                router.push(nextHref, { scroll: false });
            }, transitionMs);
        } else if (deltaX > 0) {
            committedSwipe.current = true;
            setDragDirection(1);
            setSwipeOffset(width);
            pushTimer.current = setTimeout(() => {
                router.push(previousHref, { scroll: false });
            }, transitionMs);
        } else {
            setDragDirection(null);
            setSwipeOffset(0);
        }
    }

    function handlePointerCancel() {
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
            className="relative overflow-hidden touch-pan-y"
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
                    {targetPanel ?? <DashboardPanelSkeleton />}
                </div>
            ) : null}
        </div>
    );
}
