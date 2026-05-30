'use client';

import { Button, cn } from '@xpenser/ui';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsRightIcon
} from 'lucide-react';
import Link from 'next/link';
import { type MouseEvent, useMemo } from 'react';
import {
    addDashboardPeriod,
    type DashboardPeriod,
    dashboardPeriodOptions,
    dateParam,
    isLatestDashboardPeriod,
    latestDashboardLabel,
    parseDateParam,
    periodHref
} from '@/lib/dashboard-periods';

export type DashboardPeriodSelection = {
    readonly date: string;
    readonly href: string;
    readonly period: DashboardPeriod;
};

export function DashboardPeriodNav({
    basePath = '/dashboard',
    date,
    onNavigate,
    period,
    timezone
}: {
    readonly basePath?: string;
    readonly date: string;
    readonly onNavigate?: (selection: DashboardPeriodSelection) => void;
    readonly period: DashboardPeriod;
    readonly timezone: string;
}) {
    const anchorDate = useMemo(
        () => parseDateParam(date, timezone) ?? new Date(),
        [date, timezone]
    );
    const now = useMemo(() => new Date(), []);
    const latest = isLatestDashboardPeriod(period, anchorDate, now, timezone);
    const previousDate = addDashboardPeriod(period, anchorDate, -1, timezone);
    const nextDate = addDashboardPeriod(period, anchorDate, 1, timezone);
    const previousHref = periodHref(basePath, period, previousDate, {
        timeZone: timezone
    });
    const nextHref = latest
        ? undefined
        : periodHref(basePath, period, nextDate, { timeZone: timezone });
    const latestHref = periodHref(basePath, period, now, {
        cleanDefault: true,
        timeZone: timezone
    });
    const previousDateParam = dateParam(previousDate, timezone);
    const nextDateParam = dateParam(nextDate, timezone);
    const latestDateParam = dateParam(now, timezone);

    function handleNavigate(
        event: MouseEvent<HTMLAnchorElement>,
        selection: DashboardPeriodSelection
    ) {
        if (!onNavigate) {
            return;
        }

        event.preventDefault();
        onNavigate(selection);
    }

    return (
        <div className="flex items-center gap-2">
            <Button
                asChild
                className="shrink-0"
                size="icon-sm"
                variant="outline"
            >
                <Link
                    aria-label={`Previous ${period}`}
                    href={previousHref}
                    onClick={event =>
                        handleNavigate(event, {
                            date: previousDateParam,
                            href: previousHref,
                            period
                        })
                    }
                >
                    <ChevronLeftIcon aria-hidden className="size-4" />
                </Link>
            </Button>
            <div className="grid min-w-0 flex-1 grid-cols-5 gap-1 rounded-md border bg-muted p-1">
                {dashboardPeriodOptions.map(option => {
                    const optionHref = periodHref(
                        basePath,
                        option.value,
                        anchorDate,
                        {
                            cleanDefault: true,
                            timeZone: timezone
                        }
                    );
                    return (
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
                            href={optionHref}
                            key={option.value}
                            onClick={event =>
                                handleNavigate(event, {
                                    date: dateParam(anchorDate, timezone),
                                    href: optionHref,
                                    period: option.value
                                })
                            }
                            scroll={false}
                        >
                            <span className="sm:hidden">{option.label[0]}</span>
                            <span className="hidden sm:inline">
                                {option.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
            {nextHref ? (
                <Button
                    asChild
                    className="shrink-0"
                    size="icon-sm"
                    variant="outline"
                >
                    <Link
                        aria-label={`Next ${period}`}
                        href={nextHref}
                        onClick={event =>
                            handleNavigate(event, {
                                date: nextDateParam,
                                href: nextHref,
                                period
                            })
                        }
                    >
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
                            onClick={event =>
                                handleNavigate(event, {
                                    date: latestDateParam,
                                    href: latestHref,
                                    period
                                })
                            }
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
