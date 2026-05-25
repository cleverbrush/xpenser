'use client';

import { Button, cn } from '@xpenser/ui';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsRightIcon
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import {
    addDashboardPeriod,
    type DashboardPeriod,
    dashboardPeriodOptions,
    isLatestDashboardPeriod,
    latestDashboardLabel,
    parseDateParam,
    periodHref
} from '@/lib/dashboard-periods';

export function DashboardPeriodNav({
    basePath = '/dashboard',
    date,
    period,
    timezone
}: {
    readonly basePath?: string;
    readonly date: string;
    readonly period: DashboardPeriod;
    readonly timezone: string;
}) {
    const anchorDate = useMemo(
        () => parseDateParam(date, timezone) ?? new Date(),
        [date, timezone]
    );
    const now = useMemo(() => new Date(), []);
    const latest = isLatestDashboardPeriod(period, anchorDate, now, timezone);
    const previousHref = periodHref(
        basePath,
        period,
        addDashboardPeriod(period, anchorDate, -1, timezone),
        { timeZone: timezone }
    );
    const nextHref = latest
        ? undefined
        : periodHref(
              basePath,
              period,
              addDashboardPeriod(period, anchorDate, 1, timezone),
              { timeZone: timezone }
          );
    const latestHref = periodHref(basePath, period, now, {
        cleanDefault: true,
        timeZone: timezone
    });

    return (
        <div className="flex items-center gap-2">
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
                        href={periodHref(basePath, option.value, anchorDate, {
                            cleanDefault: true,
                            timeZone: timezone
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
                {latest ? (
                    <Button
                        aria-label={latestDashboardLabel(period)}
                        className="md:w-full md:px-3"
                        disabled
                        size="icon-sm"
                        type="button"
                        variant="secondary"
                    >
                        <ChevronsRightIcon
                            aria-hidden
                            className="size-4 md:hidden"
                        />
                        <span className="hidden md:inline">
                            {latestDashboardLabel(period)}
                        </span>
                    </Button>
                ) : (
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
