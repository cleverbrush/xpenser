'use client';

import { Button, cn } from '@xpenser/ui';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type TouchEvent, useMemo, useRef } from 'react';
import {
    addDashboardPeriod,
    type DashboardPeriod,
    dashboardHref,
    dashboardPeriodOptions,
    isLatestDashboardPeriod,
    latestDashboardLabel,
    parseDateParam
} from '@/lib/dashboard-periods';

type TouchPoint = {
    readonly x: number;
    readonly y: number;
};

export function DashboardPeriodNav({
    date,
    period
}: {
    readonly date: string;
    readonly period: DashboardPeriod;
}) {
    const router = useRouter();
    const touchStart = useRef<TouchPoint | null>(null);
    const anchorDate = useMemo(
        () => parseDateParam(date) ?? new Date(),
        [date]
    );
    const now = useMemo(() => new Date(), []);
    const latest = isLatestDashboardPeriod(period, anchorDate, now);
    const previousHref = dashboardHref(
        period,
        addDashboardPeriod(period, anchorDate, -1)
    );
    const nextHref = latest
        ? undefined
        : dashboardHref(period, addDashboardPeriod(period, anchorDate, 1));
    const latestHref = dashboardHref(period, now, { cleanDefault: true });

    function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
        if (event.touches.length !== 1) {
            touchStart.current = null;
            return;
        }

        const touch = event.touches.item(0);
        if (!touch) {
            touchStart.current = null;
            return;
        }

        touchStart.current = { x: touch.clientX, y: touch.clientY };
    }

    function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
        const start = touchStart.current;
        const touch = event.changedTouches.item(0);
        touchStart.current = null;

        if (!start || !touch) {
            return;
        }

        const deltaX = touch.clientX - start.x;
        const deltaY = touch.clientY - start.y;

        if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY)) {
            return;
        }

        if (deltaX < 0 && nextHref) {
            router.push(nextHref, { scroll: false });
        } else if (deltaX > 0) {
            router.push(previousHref, { scroll: false });
        }
    }

    return (
        <div
            className="flex touch-pan-y flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            onTouchEnd={handleTouchEnd}
            onTouchStart={handleTouchStart}
        >
            <div className="flex min-w-0 items-center gap-2">
                <Button asChild size="icon-sm" variant="outline">
                    <Link aria-label={`Previous ${period}`} href={previousHref}>
                        <ChevronLeftIcon aria-hidden className="size-4" />
                    </Link>
                </Button>
                <div className="grid min-w-0 flex-1 grid-cols-5 gap-1 rounded-md border bg-muted p-1 sm:w-fit sm:flex-none">
                    {dashboardPeriodOptions.map(option => (
                        <Link
                            aria-current={
                                option.value === period ? 'page' : undefined
                            }
                            className={cn(
                                'rounded-sm px-1.5 py-1.5 text-center text-xs font-medium hover:bg-background hover:text-foreground sm:px-3 sm:text-sm',
                                option.value === period
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground'
                            )}
                            href={dashboardHref(option.value, anchorDate, {
                                cleanDefault: true
                            })}
                            key={option.value}
                            scroll={false}
                        >
                            {option.label}
                        </Link>
                    ))}
                </div>
                {nextHref ? (
                    <Button asChild size="icon-sm" variant="outline">
                        <Link aria-label={`Next ${period}`} href={nextHref}>
                            <ChevronRightIcon aria-hidden className="size-4" />
                        </Link>
                    </Button>
                ) : (
                    <Button
                        aria-label={`Next ${period}`}
                        disabled
                        size="icon-sm"
                        type="button"
                        variant="outline"
                    >
                        <ChevronRightIcon aria-hidden className="size-4" />
                    </Button>
                )}
            </div>
            {latest ? null : (
                <Button
                    asChild
                    className="self-end sm:self-auto"
                    size="sm"
                    variant="secondary"
                >
                    <Link href={latestHref} scroll={false}>
                        {latestDashboardLabel(period)}
                    </Link>
                </Button>
            )}
        </div>
    );
}
