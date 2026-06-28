'use client';

import { resolveDashboardRangeInTimeZone } from '@xpenser/timezone';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ComponentProps } from 'react';
import {
    dateParam,
    isDashboardPeriod,
    parseDateParam
} from '@/lib/dashboard-periods';

const periodSourcePaths = new Set(['/dashboard', '/vendors', '/stats']);
const periodTargetPaths = new Set([
    '/dashboard',
    '/vendors',
    '/stats',
    '/transactions'
]);
const currencyStatePaths = new Set(['/dashboard', '/vendors']);

type PeriodStateLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
    readonly href: string;
    readonly timezone?: string;
};

function pathOnly(href: string): string {
    return href.split('?')[0] ?? href;
}

export function isPeriodStatePath(path: string): boolean {
    return periodTargetPaths.has(pathOnly(path));
}

function transactionPeriodHref(
    searchParams: URLSearchParams,
    timezone: string
): string {
    const periodParam = searchParams.get('period') ?? undefined;
    const period = isDashboardPeriod(periodParam) ? periodParam : 'day';
    const anchor =
        parseDateParam(searchParams.get('date') ?? undefined, timezone) ??
        new Date();
    const range = resolveDashboardRangeInTimeZone(
        period,
        anchor,
        new Date(),
        timezone
    );
    const params = new URLSearchParams({
        from: dateParam(range.from, timezone),
        to: dateParam(range.to, timezone)
    });
    return `/transactions?${params.toString()}`;
}

export function PeriodStateLink({
    href,
    timezone = 'UTC',
    ...props
}: PeriodStateLinkProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const targetPath = pathOnly(href);
    const shouldPreserve =
        periodSourcePaths.has(pathOnly(pathname)) &&
        periodTargetPaths.has(targetPath);

    if (!shouldPreserve) {
        return <Link href={href} {...props} />;
    }

    if (targetPath === '/transactions') {
        return (
            <Link
                href={transactionPeriodHref(searchParams, timezone)}
                {...props}
            />
        );
    }

    const params = new URLSearchParams();
    const period = searchParams.get('period');
    const date = searchParams.get('date');
    const currency = searchParams.get('currency');
    if (period) {
        params.set('period', period);
    }
    if (date) {
        params.set('date', date);
    }
    if (currency && currencyStatePaths.has(targetPath)) {
        params.set('currency', currency);
    }

    const query = params.toString();
    return (
        <Link href={query ? `${targetPath}?${query}` : targetPath} {...props} />
    );
}
