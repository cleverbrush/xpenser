'use client';

import { Button, cn } from '@xpenser/ui';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsRightIcon
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type MouseEvent, type PointerEvent, useMemo, useRef } from 'react';
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
    const pointerStart = useRef<TouchPoint | null>(null);
    const didSwipe = useRef(false);
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
            className="flex touch-pan-y items-center gap-2"
            onClickCapture={handleClickCapture}
            onPointerCancel={handlePointerCancel}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
        >
            <Button
                asChild
                className="shrink-0"
                size="icon-sm"
                variant="outline"
            >
                <Link aria-label={`Previous ${period}`} href={previousHref}>
                    <ChevronLeftIcon aria-hidden className="size-4" />
                </Link>
            </Button>
            <div className="grid min-w-0 flex-1 grid-cols-5 gap-1 rounded-md border bg-muted p-1">
                {dashboardPeriodOptions.map(option => (
                    <Link
                        aria-current={
                            option.value === period ? 'page' : undefined
                        }
                        aria-label={option.label}
                        className={cn(
                            'rounded-sm px-1 py-1.5 text-center text-xs font-medium hover:bg-background hover:text-foreground sm:px-3 sm:text-sm',
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
                        <span className="sm:hidden">{option.label[0]}</span>
                        <span className="hidden sm:inline">{option.label}</span>
                    </Link>
                ))}
            </div>
            {nextHref ? (
                <Button
                    asChild
                    className="shrink-0"
                    size="icon-sm"
                    variant="outline"
                >
                    <Link aria-label={`Next ${period}`} href={nextHref}>
                        <ChevronRightIcon aria-hidden className="size-4" />
                    </Link>
                </Button>
            ) : (
                <Button
                    aria-label={`Next ${period}`}
                    className="shrink-0"
                    disabled
                    size="icon-sm"
                    type="button"
                    variant="outline"
                >
                    <ChevronRightIcon aria-hidden className="size-4" />
                </Button>
            )}
            <div className="flex h-9 w-9 shrink-0 justify-end md:w-32">
                {latest ? null : (
                    <Button
                        asChild
                        className="md:w-full md:px-3"
                        size="icon-sm"
                        variant="secondary"
                    >
                        <Link
                            aria-label={latestDashboardLabel(period)}
                            href={latestHref}
                            scroll={false}
                        >
                            <ChevronsRightIcon
                                aria-hidden
                                className="size-4 md:hidden"
                            />
                            <span className="hidden md:inline">
                                {latestDashboardLabel(period)}
                            </span>
                        </Link>
                    </Button>
                )}
            </div>
        </div>
    );
}
