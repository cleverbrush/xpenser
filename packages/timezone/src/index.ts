import { Temporal } from '@js-temporal/polyfill';

export type DateInput = Date | string | number;
export type DashboardPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type StatsGroupBy = 'day' | 'hour' | 'month' | 'week';
export type Range = {
    readonly from: Date;
    readonly to: Date;
};

export const defaultTimeZone = 'UTC';

const dateParamPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const dateTimeLocalPattern =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

function pad(value: number, length = 2): string {
    return String(value).padStart(length, '0');
}

function validDate(value: DateInput): Date | undefined {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateFromZoned(value: Temporal.ZonedDateTime): Date {
    return new Date(value.epochMilliseconds);
}

function plainDateFromParam(value: string): Temporal.PlainDate | undefined {
    const match = dateParamPattern.exec(value);
    if (!match) {
        return undefined;
    }

    try {
        return Temporal.PlainDate.from(
            {
                year: Number(match[1]),
                month: Number(match[2]),
                day: Number(match[3])
            },
            { overflow: 'reject' }
        );
    } catch {
        return undefined;
    }
}

function zonedFromParts(
    timeZone: string,
    parts: {
        readonly year: number;
        readonly month: number;
        readonly day: number;
        readonly hour?: number;
        readonly minute?: number;
        readonly second?: number;
        readonly millisecond?: number;
    }
): Temporal.ZonedDateTime {
    return Temporal.ZonedDateTime.from(
        {
            year: parts.year,
            month: parts.month,
            day: parts.day,
            hour: parts.hour ?? 0,
            minute: parts.minute ?? 0,
            second: parts.second ?? 0,
            millisecond: parts.millisecond ?? 0,
            timeZone
        },
        { disambiguation: 'compatible', overflow: 'reject' }
    );
}

function dateInputToZoned(
    value: DateInput,
    timeZone: string
): Temporal.ZonedDateTime {
    const date = validDate(value);
    if (!date) {
        throw new RangeError('Invalid date.');
    }

    return Temporal.Instant.fromEpochMilliseconds(
        date.getTime()
    ).toZonedDateTimeISO(normalizeTimeZone(timeZone));
}

function startOfLocalDayZoned(
    value: DateInput,
    timeZone: string
): Temporal.ZonedDateTime {
    return dateInputToZoned(value, timeZone).startOfDay();
}

function startOfLocalHourZoned(
    value: DateInput,
    timeZone: string
): Temporal.ZonedDateTime {
    return dateInputToZoned(value, timeZone).with({
        minute: 0,
        second: 0,
        millisecond: 0,
        microsecond: 0,
        nanosecond: 0
    });
}

function endOfLocalDayZoned(
    value: DateInput,
    timeZone: string
): Temporal.ZonedDateTime {
    return startOfLocalDayZoned(value, timeZone)
        .add({ days: 1 })
        .subtract({ milliseconds: 1 });
}

function startOfLocalWeekZoned(
    value: DateInput,
    timeZone: string
): Temporal.ZonedDateTime {
    const start = startOfLocalDayZoned(value, timeZone);
    return start.subtract({ days: start.dayOfWeek - 1 });
}

function startOfLocalMonthZoned(
    value: DateInput,
    timeZone: string
): Temporal.ZonedDateTime {
    const zoned = dateInputToZoned(value, timeZone);
    return zonedFromParts(normalizeTimeZone(timeZone), {
        year: zoned.year,
        month: zoned.month,
        day: 1
    });
}

function startOfLocalQuarterZoned(
    value: DateInput,
    timeZone: string
): Temporal.ZonedDateTime {
    const zoned = dateInputToZoned(value, timeZone);
    return zonedFromParts(normalizeTimeZone(timeZone), {
        year: zoned.year,
        month: Math.floor((zoned.month - 1) / 3) * 3 + 1,
        day: 1
    });
}

function startOfLocalYearZoned(
    value: DateInput,
    timeZone: string
): Temporal.ZonedDateTime {
    const zoned = dateInputToZoned(value, timeZone);
    return zonedFromParts(normalizeTimeZone(timeZone), {
        year: zoned.year,
        month: 1,
        day: 1
    });
}

function endFromStart(
    start: Temporal.ZonedDateTime,
    duration: Temporal.DurationLike
): Temporal.ZonedDateTime {
    return start.add(duration).subtract({ milliseconds: 1 });
}

function periodStartZoned(
    period: DashboardPeriod,
    value: DateInput,
    timeZone: string
): Temporal.ZonedDateTime {
    if (period === 'day') {
        return startOfLocalDayZoned(value, timeZone);
    }
    if (period === 'week') {
        return startOfLocalWeekZoned(value, timeZone);
    }
    if (period === 'month') {
        return startOfLocalMonthZoned(value, timeZone);
    }
    if (period === 'quarter') {
        return startOfLocalQuarterZoned(value, timeZone);
    }
    return startOfLocalYearZoned(value, timeZone);
}

function periodEndZoned(
    period: DashboardPeriod,
    value: DateInput,
    timeZone: string
): Temporal.ZonedDateTime {
    const start = periodStartZoned(period, value, timeZone);
    if (period === 'day') {
        return endFromStart(start, { days: 1 });
    }
    if (period === 'week') {
        return endFromStart(start, { days: 7 });
    }
    if (period === 'month') {
        return endFromStart(start, { months: 1 });
    }
    if (period === 'quarter') {
        return endFromStart(start, { months: 3 });
    }
    return endFromStart(start, { years: 1 });
}

export function isValidTimeZone(value: unknown): value is string {
    if (typeof value !== 'string' || value.trim() === '') {
        return false;
    }

    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value.trim() });
        return true;
    } catch {
        return false;
    }
}

export function normalizeTimeZone(value: unknown): string {
    return isValidTimeZone(value) ? value.trim() : defaultTimeZone;
}

export function dateToLocalDateTimeInput(
    value: DateInput,
    timeZone: string
): string {
    const zoned = dateInputToZoned(value, timeZone);
    return `${pad(zoned.year, 4)}-${pad(zoned.month)}-${pad(zoned.day)}T${pad(
        zoned.hour
    )}:${pad(zoned.minute)}`;
}

export function dateToLocalDateParam(
    value: DateInput,
    timeZone: string
): string {
    const zoned = dateInputToZoned(value, timeZone);
    return `${pad(zoned.year, 4)}-${pad(zoned.month)}-${pad(zoned.day)}`;
}

export function localDateParamToDate(
    value: string | undefined,
    timeZone: string,
    boundary: 'end' | 'start'
): Date | undefined {
    if (!value) {
        return undefined;
    }

    const plainDate = plainDateFromParam(value);
    if (!plainDate) {
        return undefined;
    }

    const start = zonedFromParts(normalizeTimeZone(timeZone), {
        year: plainDate.year,
        month: plainDate.month,
        day: plainDate.day
    }).startOfDay();

    return dateFromZoned(
        boundary === 'start'
            ? start
            : start.add({ days: 1 }).subtract({ milliseconds: 1 })
    );
}

export function localDateTimeInputToDate(
    value: string,
    timeZone: string
): Date | undefined {
    const match = dateTimeLocalPattern.exec(value.trim());
    if (!match) {
        return undefined;
    }

    try {
        const zoned = zonedFromParts(normalizeTimeZone(timeZone), {
            year: Number(match[1]),
            month: Number(match[2]),
            day: Number(match[3]),
            hour: Number(match[4]),
            minute: Number(match[5]),
            second: match[6] ? Number(match[6]) : 0,
            millisecond: match[7] ? Number(match[7].padEnd(3, '0')) : 0
        });
        return dateFromZoned(zoned);
    } catch {
        return undefined;
    }
}

export function formatDateInTimeZone(
    value: DateInput,
    timeZone: string,
    options: Intl.DateTimeFormatOptions,
    locale = 'en-US'
): string {
    const date = validDate(value);
    return date
        ? new Intl.DateTimeFormat(locale, {
              ...options,
              timeZone: normalizeTimeZone(timeZone)
          }).format(date)
        : '';
}

export function localStartOfDay(value: DateInput, timeZone: string): Date {
    return dateFromZoned(startOfLocalDayZoned(value, timeZone));
}

export function localStartOfHour(value: DateInput, timeZone: string): Date {
    return dateFromZoned(startOfLocalHourZoned(value, timeZone));
}

export function localEndOfDay(value: DateInput, timeZone: string): Date {
    return dateFromZoned(endOfLocalDayZoned(value, timeZone));
}

export function localStartOfWeek(value: DateInput, timeZone: string): Date {
    return dateFromZoned(startOfLocalWeekZoned(value, timeZone));
}

export function localEndOfWeek(value: DateInput, timeZone: string): Date {
    return dateFromZoned(
        endFromStart(startOfLocalWeekZoned(value, timeZone), {
            days: 7
        })
    );
}

export function localStartOfMonth(value: DateInput, timeZone: string): Date {
    return dateFromZoned(startOfLocalMonthZoned(value, timeZone));
}

export function localEndOfMonth(value: DateInput, timeZone: string): Date {
    return dateFromZoned(
        endFromStart(startOfLocalMonthZoned(value, timeZone), {
            months: 1
        })
    );
}

export function localStartOfQuarter(value: DateInput, timeZone: string): Date {
    return dateFromZoned(startOfLocalQuarterZoned(value, timeZone));
}

export function localEndOfQuarter(value: DateInput, timeZone: string): Date {
    return dateFromZoned(
        endFromStart(startOfLocalQuarterZoned(value, timeZone), {
            months: 3
        })
    );
}

export function localStartOfYear(value: DateInput, timeZone: string): Date {
    return dateFromZoned(startOfLocalYearZoned(value, timeZone));
}

export function localEndOfYear(value: DateInput, timeZone: string): Date {
    return dateFromZoned(
        endFromStart(startOfLocalYearZoned(value, timeZone), {
            years: 1
        })
    );
}

export function addLocalDays(
    value: DateInput,
    days: number,
    timeZone: string
): Date {
    return dateFromZoned(dateInputToZoned(value, timeZone).add({ days }));
}

export function addLocalMonths(
    value: DateInput,
    months: number,
    timeZone: string
): Date {
    return dateFromZoned(dateInputToZoned(value, timeZone).add({ months }));
}

export function addLocalYears(
    value: DateInput,
    years: number,
    timeZone: string
): Date {
    return dateFromZoned(dateInputToZoned(value, timeZone).add({ years }));
}

export function resolveDashboardRangeInTimeZone(
    period: DashboardPeriod,
    date: DateInput | undefined,
    now: Date,
    timeZone: string
): Range {
    const anchor = date && validDate(date) ? date : now;
    const from = periodStartZoned(period, anchor, timeZone);
    const end = periodEndZoned(period, anchor, timeZone);
    const current = dateInputToZoned(now, timeZone);
    const to =
        Temporal.ZonedDateTime.compare(from, current) <= 0 &&
        Temporal.ZonedDateTime.compare(current, end) <= 0
            ? current
            : end;

    return {
        from: dateFromZoned(from),
        to: dateFromZoned(to)
    };
}

export function resolveDashboardComparisonRangeInTimeZone(
    period: DashboardPeriod,
    range: Range,
    timeZone: string
): Range {
    const previousAnchor =
        period === 'day'
            ? addLocalDays(range.from, -1, timeZone)
            : period === 'week'
              ? addLocalDays(range.from, -7, timeZone)
              : period === 'month'
                ? addLocalMonths(range.from, -1, timeZone)
                : period === 'quarter'
                  ? addLocalMonths(range.from, -3, timeZone)
                  : addLocalYears(range.from, -1, timeZone);

    return {
        from: dateFromZoned(periodStartZoned(period, previousAnchor, timeZone)),
        to: dateFromZoned(periodEndZoned(period, previousAnchor, timeZone))
    };
}

export function addDashboardPeriodInTimeZone(
    period: DashboardPeriod,
    value: DateInput,
    direction: -1 | 1,
    timeZone: string
): Date {
    if (period === 'day') {
        return addLocalDays(value, direction, timeZone);
    }
    if (period === 'week') {
        return addLocalDays(value, direction * 7, timeZone);
    }
    if (period === 'month') {
        return addLocalMonths(value, direction, timeZone);
    }
    if (period === 'quarter') {
        return addLocalMonths(value, direction * 3, timeZone);
    }
    return addLocalYears(value, direction, timeZone);
}

export function isLatestDashboardPeriodInTimeZone(
    period: DashboardPeriod,
    value: DateInput,
    now: Date,
    timeZone: string
): boolean {
    return (
        periodStartZoned(period, value, timeZone).epochMilliseconds ===
        periodStartZoned(period, now, timeZone).epochMilliseconds
    );
}

export function localDayDifference(
    from: DateInput,
    to: DateInput,
    timeZone: string
): number {
    const start = startOfLocalDayZoned(from, timeZone).toPlainDate();
    const end = startOfLocalDayZoned(to, timeZone).toPlainDate();
    return start.until(end, { largestUnit: 'day' }).days;
}

export function localHour(value: DateInput, timeZone: string): number {
    return dateInputToZoned(value, timeZone).hour;
}

export function localMonthIndex(value: DateInput, timeZone: string): number {
    return dateInputToZoned(value, timeZone).month - 1;
}

export function statsBucketKeyInTimeZone(
    value: DateInput,
    groupBy: StatsGroupBy,
    timeZone: string
): string {
    const zoned =
        groupBy === 'week'
            ? startOfLocalWeekZoned(value, timeZone)
            : dateInputToZoned(value, timeZone);
    const year = pad(zoned.year, 4);
    const month = pad(zoned.month);
    const day = pad(zoned.day);

    if (groupBy === 'hour') {
        return `${year}-${month}-${day}T${pad(zoned.hour)}`;
    }
    if (groupBy === 'month') {
        return `${year}-${month}`;
    }
    return `${year}-${month}-${day}`;
}

export function statsBucketLabelInTimeZone(
    value: DateInput,
    groupBy: StatsGroupBy,
    timeZone: string
): string {
    if (groupBy === 'hour') {
        return formatDateInTimeZone(value, timeZone, { hour: 'numeric' });
    }
    if (groupBy === 'month') {
        return formatDateInTimeZone(value, timeZone, {
            month: 'short',
            year: '2-digit'
        });
    }
    if (groupBy === 'week') {
        return `Week of ${formatDateInTimeZone(value, timeZone, {
            month: 'short',
            day: 'numeric'
        })}`;
    }
    return formatDateInTimeZone(value, timeZone, {
        month: 'short',
        day: 'numeric'
    });
}

export function addStatsBucketStepInTimeZone(
    value: DateInput,
    groupBy: StatsGroupBy,
    timeZone: string
): Date {
    if (groupBy === 'hour') {
        return dateFromZoned(
            startOfLocalHourZoned(value, timeZone).add({ hours: 1 })
        );
    }
    if (groupBy === 'month') {
        return dateFromZoned(
            startOfLocalMonthZoned(value, timeZone).add({ months: 1 })
        );
    }
    return dateFromZoned(
        startOfLocalDayZoned(value, timeZone).add({
            days: groupBy === 'week' ? 7 : 1
        })
    );
}
