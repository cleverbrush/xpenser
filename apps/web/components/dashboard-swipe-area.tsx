'use client';

import { useRouter } from 'next/navigation';
import {
    type MouseEvent,
    type PointerEvent,
    type ReactNode,
    useMemo,
    useRef
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

    function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
        pointerStart.current = { x: event.clientX, y: event.clientY };
        didSwipe.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
    }

    function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
        const start = pointerStart.current;
        pointerStart.current = null;

        if (!start) {
            return;
        }

        const deltaX = event.clientX - start.x;
        const deltaY = event.clientY - start.y;

        if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY)) {
            return;
        }

        didSwipe.current = true;
        if (deltaX < 0 && nextHref) {
            router.push(nextHref, { scroll: false });
        } else if (deltaX > 0) {
            router.push(previousHref, { scroll: false });
        }
    }

    function handlePointerCancel() {
        pointerStart.current = null;
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
            className="flex touch-pan-y flex-col gap-5 sm:gap-6"
            onClickCapture={handleClickCapture}
            onPointerCancel={handlePointerCancel}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
        >
            {children}
        </div>
    );
}
