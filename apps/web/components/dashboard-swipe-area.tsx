'use client';

import { useRouter } from 'next/navigation';
import {
    type MouseEvent,
    type PointerEvent,
    type ReactNode,
    useEffect,
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
    const pointerStart = useRef<PointerPoint | null>(null);
    const didSwipe = useRef(false);
    const prefetchedHref = useRef<string | null>(null);
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

    useEffect(() => {
        if (!resetKey) {
            return;
        }

        pointerStart.current = null;
        prefetchedHref.current = null;
        setIsDragging(false);
        setSwipeOffset(0);
    }, [resetKey]);

    function prefetch(href?: string) {
        if (!href || prefetchedHref.current === href) {
            return;
        }

        prefetchedHref.current = href;
        router.prefetch(href);
    }

    function offsetForSwipe(deltaX: number): number {
        const canNavigate = deltaX > 0 || Boolean(nextHref);
        const maxOffset = canNavigate ? 36 : 14;
        return Math.max(-maxOffset, Math.min(maxOffset, deltaX / 4));
    }

    function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
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

        if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY)) {
            setSwipeOffset(0);
            return;
        }

        didSwipe.current = true;
        if (deltaX < 0 && nextHref) {
            setSwipeOffset(-36);
            router.push(nextHref, { scroll: false });
        } else if (deltaX > 0) {
            setSwipeOffset(36);
            router.push(previousHref, { scroll: false });
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
        >
            <div
                className={`flex flex-col gap-5 sm:gap-6 ${
                    isDragging
                        ? 'transition-none'
                        : 'transition-transform duration-150 ease-out'
                }`}
                style={{ transform: `translateX(${swipeOffset}px)` }}
            >
                {children}
            </div>
        </div>
    );
}
