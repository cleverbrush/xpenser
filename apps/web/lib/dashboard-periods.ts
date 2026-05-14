import type { DashboardSummary } from '@xpenser/contracts';

export type DashboardPeriod = DashboardSummary['period'];

export const dashboardPeriodOptions = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'quarter', label: 'Quarter' },
    { value: 'year', label: 'Year' }
] as const satisfies readonly {
    readonly value: DashboardPeriod;
    readonly label: string;
}[];

const dashboardPeriods = dashboardPeriodOptions.map(option => option.value);

type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
    return value instanceof Date ? value : new Date(value);
}

function startOfDay(value: Date): Date {
    const date = new Date(value.getTime());
    date.setHours(0, 0, 0, 0);
    return date;
}

function startOfWeek(value: Date): Date {
    const date = startOfDay(value);
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    return date;
}

function startOfMonth(value: Date): Date {
    const date = startOfDay(value);
    date.setDate(1);
    return date;
}

function startOfQuarter(value: Date): Date {
    const date = startOfMonth(value);
    date.setMonth(Math.floor(date.getMonth() / 3) * 3, 1);
    return date;
}

function startOfYear(value: Date): Date {
    const date = startOfDay(value);
    date.setMonth(0, 1);
    return date;
}

function daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

function addDays(value: Date, days: number): Date {
    const date = new Date(value.getTime());
    date.setDate(date.getDate() + days);
    return date;
}

function addMonthsClamped(value: Date, months: number): Date {
    const source = new Date(value.getTime());
    const day = source.getDate();
    source.setDate(1);
    source.setMonth(source.getMonth() + months);
    source.setDate(
        Math.min(day, daysInMonth(source.getFullYear(), source.getMonth()))
    );
    return source;
}

function addYearsClamped(value: Date, years: number): Date {
    const source = new Date(value.getTime());
    const day = source.getDate();
    source.setDate(1);
    source.setFullYear(source.getFullYear() + years);
    source.setDate(
        Math.min(day, daysInMonth(source.getFullYear(), source.getMonth()))
    );
    return source;
}

function periodStart(period: DashboardPeriod, value: Date): Date {
    if (period === 'day') {
        return startOfDay(value);
    }
    if (period === 'week') {
        return startOfWeek(value);
    }
    if (period === 'month') {
        return startOfMonth(value);
    }
    if (period === 'quarter') {
        return startOfQuarter(value);
    }
    return startOfYear(value);
}

function formatRangeDate(
    value: Date,
    currentYear: number,
    forceYear = false
): string {
    return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        ...(forceYear || value.getFullYear() !== currentYear
            ? { year: 'numeric' }
            : {})
    }).format(value);
}

function formatMonth(value: Date, currentYear: number): string {
    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        ...(value.getFullYear() !== currentYear ? { year: 'numeric' } : {})
    }).format(value);
}

export function isDashboardPeriod(value?: string): value is DashboardPeriod {
    return dashboardPeriods.includes(value as DashboardPeriod);
}

export function dateParam(value: DateInput): string {
    const date = toDate(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function parseDateParam(value?: string): Date | undefined {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
    if (!match) {
        return undefined;
    }

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);

    return date.getFullYear() === year &&
        date.getMonth() === month &&
        date.getDate() === day
        ? date
        : undefined;
}

export function addDashboardPeriod(
    period: DashboardPeriod,
    value: Date,
    direction: -1 | 1
): Date {
    if (period === 'day') {
        return addDays(value, direction);
    }
    if (period === 'week') {
        return addDays(value, direction * 7);
    }
    if (period === 'month') {
        return addMonthsClamped(value, direction);
    }
    if (period === 'quarter') {
        return addMonthsClamped(value, direction * 3);
    }
    return addYearsClamped(value, direction);
}

export function isLatestDashboardPeriod(
    period: DashboardPeriod,
    value: Date,
    now = new Date()
): boolean {
    return (
        periodStart(period, value).getTime() ===
        periodStart(period, now).getTime()
    );
}

export function latestDashboardLabel(period: DashboardPeriod): string {
    if (period === 'day') {
        return 'Today';
    }
    return `This ${period}`;
}

export function dashboardHref(
    period: DashboardPeriod,
    value: Date,
    options: { readonly cleanDefault?: boolean } = {}
): string {
    if (
        options.cleanDefault &&
        period === 'day' &&
        isLatestDashboardPeriod(period, value)
    ) {
        return '/dashboard';
    }

    const params = new URLSearchParams({
        period,
        date: dateParam(value)
    });
    return `/dashboard?${params.toString()}`;
}

export function formatDashboardRangeLabel({
    from,
    period,
    to,
    now = new Date()
}: {
    readonly from: DateInput;
    readonly period: DashboardPeriod;
    readonly to: DateInput;
    readonly now?: Date;
}): string {
    const start = toDate(from);
    const end = toDate(to);
    const currentYear = now.getFullYear();

    if (period === 'month') {
        return formatMonth(start, currentYear);
    }

    if (period === 'quarter') {
        const quarter = Math.floor(start.getMonth() / 3) + 1;
        return start.getFullYear() === currentYear
            ? `Q${quarter}`
            : `Q${quarter} ${start.getFullYear()}`;
    }

    if (period === 'year') {
        return String(start.getFullYear());
    }

    if (dateParam(start) === dateParam(end)) {
        return formatRangeDate(start, currentYear);
    }

    if (start.getFullYear() === end.getFullYear()) {
        return start.getFullYear() === currentYear
            ? `${formatRangeDate(start, currentYear)} - ${formatRangeDate(
                  end,
                  currentYear
              )}`
            : `${formatRangeDate(start, currentYear)} - ${formatRangeDate(
                  end,
                  currentYear,
                  true
              )}`;
    }

    return `${formatRangeDate(start, currentYear, true)} - ${formatRangeDate(
        end,
        currentYear,
        true
    )}`;
}
