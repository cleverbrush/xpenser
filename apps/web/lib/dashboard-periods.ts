import type { DashboardSummary } from '@xpenser/contracts';
import {
    addDashboardPeriodInTimeZone,
    dateToLocalDateParam,
    defaultTimeZone,
    formatDateInTimeZone,
    isLatestDashboardPeriodInTimeZone,
    localDateParamToDate
} from '@xpenser/timezone';

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

function localParts(value: DateInput, timeZone: string) {
    const [year, month, day] = dateToLocalDateParam(value, timeZone)
        .split('-')
        .map(Number);
    return { year: year ?? 0, month: month ?? 0, day: day ?? 0 };
}

function formatRangeDate(
    value: Date,
    currentYear: number,
    timeZone: string,
    forceYear = false
): string {
    const { year } = localParts(value, timeZone);
    return formatDateInTimeZone(
        value,
        timeZone,
        {
            day: 'numeric',
            month: 'short',
            ...(forceYear || year !== currentYear ? { year: 'numeric' } : {})
        },
        'en-GB'
    );
}

function formatMonth(
    value: Date,
    currentYear: number,
    timeZone: string
): string {
    const { year } = localParts(value, timeZone);
    return formatDateInTimeZone(value, timeZone, {
        month: 'long',
        ...(year !== currentYear ? { year: 'numeric' } : {})
    });
}

export function isDashboardPeriod(value?: string): value is DashboardPeriod {
    return dashboardPeriods.includes(value as DashboardPeriod);
}

export function dateParam(
    value: DateInput,
    timeZone = defaultTimeZone
): string {
    return dateToLocalDateParam(value, timeZone);
}

export function parseDateParam(
    value?: string,
    timeZone = defaultTimeZone
): Date | undefined {
    return localDateParamToDate(value, timeZone, 'start');
}

export function addDashboardPeriod(
    period: DashboardPeriod,
    value: Date,
    direction: -1 | 1,
    timeZone = defaultTimeZone
): Date {
    return addDashboardPeriodInTimeZone(period, value, direction, timeZone);
}

export function isLatestDashboardPeriod(
    period: DashboardPeriod,
    value: Date,
    now = new Date(),
    timeZone = defaultTimeZone
): boolean {
    return isLatestDashboardPeriodInTimeZone(period, value, now, timeZone);
}

export function latestDashboardLabel(period: DashboardPeriod): string {
    if (period === 'day') {
        return 'Today';
    }
    return `This ${period}`;
}

export function periodHref(
    basePath: string,
    period: DashboardPeriod,
    value: Date,
    options: {
        readonly cleanDefault?: boolean;
        readonly extraParams?: Readonly<Record<string, string | undefined>>;
        readonly timeZone?: string;
    } = {}
): string {
    const timeZone = options.timeZone ?? defaultTimeZone;
    const params = new URLSearchParams();
    for (const [key, paramValue] of Object.entries(options.extraParams ?? {})) {
        if (paramValue) {
            params.set(key, paramValue);
        }
    }
    if (
        options.cleanDefault &&
        period === 'day' &&
        isLatestDashboardPeriod(period, value, new Date(), timeZone)
    ) {
        const query = params.toString();
        return query ? `${basePath}?${query}` : basePath;
    }

    params.set('period', period);
    params.set('date', dateParam(value, timeZone));
    return `${basePath}?${params.toString()}`;
}

export function dashboardHref(
    period: DashboardPeriod,
    value: Date,
    options: {
        readonly cleanDefault?: boolean;
        readonly timeZone?: string;
    } = {}
): string {
    return periodHref('/dashboard', period, value, options);
}

export function formatDashboardRangeLabel({
    from,
    period,
    to,
    now = new Date(),
    timeZone = defaultTimeZone
}: {
    readonly from: DateInput;
    readonly period: DashboardPeriod;
    readonly to: DateInput;
    readonly now?: Date;
    readonly timeZone?: string;
}): string {
    const start = from instanceof Date ? from : new Date(from);
    const end = to instanceof Date ? to : new Date(to);
    const currentYear = localParts(now, timeZone).year;
    const startParts = localParts(start, timeZone);
    const endParts = localParts(end, timeZone);

    if (period === 'month') {
        return formatMonth(start, currentYear, timeZone);
    }

    if (period === 'quarter') {
        const quarter = Math.floor((startParts.month - 1) / 3) + 1;
        return startParts.year === currentYear
            ? `Q${quarter}`
            : `Q${quarter} ${startParts.year}`;
    }

    if (period === 'year') {
        return String(startParts.year);
    }

    if (dateParam(start, timeZone) === dateParam(end, timeZone)) {
        return formatRangeDate(start, currentYear, timeZone);
    }

    if (startParts.year === endParts.year) {
        return startParts.year === currentYear
            ? `${formatRangeDate(start, currentYear, timeZone)} - ${formatRangeDate(
                  end,
                  currentYear,
                  timeZone
              )}`
            : `${formatRangeDate(
                  start,
                  currentYear,
                  timeZone,
                  true
              )} - ${formatRangeDate(end, currentYear, timeZone, true)}`;
    }

    return `${formatRangeDate(
        start,
        currentYear,
        timeZone,
        true
    )} - ${formatRangeDate(end, currentYear, timeZone, true)}`;
}
