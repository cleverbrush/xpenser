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
    isLatestDashboardPeriod,
    parseDateParam
} from '@/lib/dashboard-periods';

type PointerPoint = {
    readonly x: number;
    readonly y: number;
};

const transitionMs = 180;

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
    const prefetchedHref = useRef<string | null>(null);
    const incomingDirection = useRef<-1 | 1 | null>(null);
    const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const resetKey = `${period}:${date}`;
    const anchorDate = useMemo(
        () => parseDateParam(date) ?? new Date(),
        [date]
    );
    const latest = isLatestDashboardPeriod(period, anchorDate);
    const previousHref = dashboardHref(
        period,
        addDashboardPeriod(period, anchorDate, -1)
    );
    const nextHref = latest
        ? undefined
        : dashboardHref(period, addDashboardPeriod(period, anchorDate, 1));

    const viewportWidth = useCallback((): number => {
        return (
            containerRef.current?.getBoundingClientRect().width ??
            window.innerWidth
        );
    }, []);

    useLayoutEffect(() => {
        if (!resetKey) {
            return;
        }

        if (pushTimer.current) {
            clearTimeout(pushTimer.current);
            pushTimer.current = null;
        }

        pointerStart.current = null;
        prefetchedHref.current = null;
        didSwipe.current = false;

        const direction = incomingDirection.current;
        incomingDirection.current = null;
        if (direction) {
            setIsDragging(true);
            setSwipeOffset(-direction * viewportWidth());
            requestAnimationFrame(() => {
                setIsDragging(false);
                setSwipeOffset(0);
            });
            return;
        }

        setIsDragging(false);
        setSwipeOffset(0);
    }, [resetKey, viewportWidth]);

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
        }

        pointerStart.current = { x: event.clientX, y: event.clientY };
        didSwipe.current = false;
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
            setSwipeOffset(0);
            return;
        }

        didSwipe.current = true;
        if (deltaX < 0 && nextHref) {
            incomingDirection.current = -1;
            setSwipeOffset(-width);
            pushTimer.current = setTimeout(() => {
                router.push(nextHref, { scroll: false });
            }, transitionMs);
        } else if (deltaX > 0) {
            incomingDirection.current = 1;
            setSwipeOffset(width);
            pushTimer.current = setTimeout(() => {
                router.push(previousHref, { scroll: false });
            }, transitionMs);
        } else {
            setSwipeOffset(0);
        }
    }

    function handlePointerCancel() {
        pointerStart.current = null;
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
            className="overflow-hidden touch-pan-y"
            onClickCapture={handleClickCapture}
            onPointerCancel={handlePointerCancel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            ref={containerRef}
        >
            <div
                className={`flex flex-col gap-5 sm:gap-6 ${
                    isDragging
                        ? 'transition-none'
                        : 'transition-transform duration-200 ease-out'
                }`}
                style={{ transform: `translateX(${swipeOffset}px)` }}
            >
                {children}
            </div>
        </div>
    );
}
