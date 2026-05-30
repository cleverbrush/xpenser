import { describe, expect, it } from 'vitest';
import {
    addDashboardPeriodInTimeZone,
    addStatsBucketStepInTimeZone,
    dateToLocalDateParam,
    dateToLocalDateTimeInput,
    formatDateInTimeZone,
    isLatestDashboardPeriodInTimeZone,
    isValidTimeZone,
    localDateParamToDate,
    localDateTimeInputToDate,
    localDayDifference,
    localEndOfMonth,
    localEndOfQuarter,
    localEndOfWeek,
    localEndOfYear,
    localHour,
    localMonthIndex,
    localStartOfHour,
    localStartOfMonth,
    localStartOfQuarter,
    localStartOfWeek,
    localStartOfYear,
    normalizeTimeZone,
    resolveDashboardComparisonRangeInTimeZone,
    resolveDashboardRangeInTimeZone,
    statsBucketKeyInTimeZone,
    statsBucketLabelInTimeZone
} from './index.js';

describe('timezone helpers', () => {
    it('converts local date-times to instants in the selected timezone', () => {
        expect(
            localDateTimeInputToDate('2026-05-10T09:30', 'America/New_York')
        ).toEqual(new Date('2026-05-10T13:30:00.000Z'));
    });

    it('formats instants as local datetime input values', () => {
        expect(
            dateToLocalDateTimeInput(
                new Date('2026-05-10T13:30:00.000Z'),
                'America/New_York'
            )
        ).toBe('2026-05-10T09:30');
    });

    it('uses local day boundaries for date params', () => {
        expect(
            localDateParamToDate('2026-05-10', 'America/Los_Angeles', 'start')
        ).toEqual(new Date('2026-05-10T07:00:00.000Z'));
        expect(
            localDateParamToDate('2026-05-10', 'America/Los_Angeles', 'end')
        ).toEqual(new Date('2026-05-11T06:59:59.999Z'));
    });

    it('rejects malformed local date inputs', () => {
        expect(
            localDateParamToDate('2026-02-31', 'UTC', 'start')
        ).toBeUndefined();
        expect(localDateTimeInputToDate('not-a-date', 'UTC')).toBeUndefined();
        expect(
            localDateTimeInputToDate('2026-13-10T09:30', 'UTC')
        ).toBeUndefined();
    });

    it('normalizes invalid time zones to UTC', () => {
        expect(isValidTimeZone('America/New_York')).toBe(true);
        expect(isValidTimeZone('Not/AZone')).toBe(false);
        expect(normalizeTimeZone(' Not/AZone ')).toBe('UTC');
        expect(
            formatDateInTimeZone(
                new Date('2026-05-10T00:00:00.000Z'),
                'Not/AZone',
                { timeZoneName: 'short' }
            )
        ).toContain('UTC');
        expect(formatDateInTimeZone('invalid', 'UTC', {})).toBe('');
    });

    it('formats local date params and period boundaries', () => {
        const instant = new Date('2026-05-10T06:30:00.000Z');
        expect(dateToLocalDateParam(instant, 'America/Los_Angeles')).toBe(
            '2026-05-09'
        );
        expect(localStartOfHour(instant, 'America/Los_Angeles')).toEqual(
            new Date('2026-05-10T06:00:00.000Z')
        );
        expect(localStartOfWeek(instant, 'America/Los_Angeles')).toEqual(
            new Date('2026-05-04T07:00:00.000Z')
        );
        expect(localEndOfWeek(instant, 'America/Los_Angeles')).toEqual(
            new Date('2026-05-11T06:59:59.999Z')
        );
        expect(localStartOfMonth(instant, 'America/Los_Angeles')).toEqual(
            new Date('2026-05-01T07:00:00.000Z')
        );
        expect(localEndOfMonth(instant, 'America/Los_Angeles')).toEqual(
            new Date('2026-06-01T06:59:59.999Z')
        );
        expect(localStartOfQuarter(instant, 'America/Los_Angeles')).toEqual(
            new Date('2026-04-01T07:00:00.000Z')
        );
        expect(localEndOfQuarter(instant, 'America/Los_Angeles')).toEqual(
            new Date('2026-07-01T06:59:59.999Z')
        );
        expect(localStartOfYear(instant, 'America/Los_Angeles')).toEqual(
            new Date('2026-01-01T08:00:00.000Z')
        );
        expect(localEndOfYear(instant, 'America/Los_Angeles')).toEqual(
            new Date('2027-01-01T07:59:59.999Z')
        );
    });

    it('resolves dashboard ranges and comparisons in the selected timezone', () => {
        const range = resolveDashboardRangeInTimeZone(
            'month',
            new Date('2026-05-10T06:30:00.000Z'),
            new Date('2026-05-12T12:00:00.000Z'),
            'America/Los_Angeles'
        );
        expect(range).toEqual({
            from: new Date('2026-05-01T07:00:00.000Z'),
            to: new Date('2026-05-12T12:00:00.000Z')
        });
        expect(
            resolveDashboardComparisonRangeInTimeZone(
                'month',
                range,
                'America/Los_Angeles'
            )
        ).toEqual({
            from: new Date('2026-04-01T07:00:00.000Z'),
            to: new Date('2026-05-01T06:59:59.999Z')
        });
        expect(
            addDashboardPeriodInTimeZone(
                'quarter',
                new Date('2026-05-10T06:30:00.000Z'),
                1,
                'America/Los_Angeles'
            )
        ).toEqual(new Date('2026-08-10T06:30:00.000Z'));
        expect(
            isLatestDashboardPeriodInTimeZone(
                'month',
                new Date('2026-05-01T07:00:00.000Z'),
                new Date('2026-05-29T12:00:00.000Z'),
                'America/Los_Angeles'
            )
        ).toBe(true);
    });

    it('builds stats bucket keys, labels, and steps', () => {
        const instant = new Date('2026-05-10T13:30:00.000Z');
        expect(
            statsBucketKeyInTimeZone(instant, 'hour', 'America/New_York')
        ).toBe('2026-05-10T09');
        expect(
            statsBucketKeyInTimeZone(instant, 'week', 'America/New_York')
        ).toBe('2026-05-04');
        expect(
            statsBucketKeyInTimeZone(instant, 'month', 'America/New_York')
        ).toBe('2026-05');
        expect(
            statsBucketKeyInTimeZone(instant, 'year', 'America/New_York')
        ).toBe('2026');
        expect(
            statsBucketLabelInTimeZone(instant, 'week', 'America/New_York')
        ).toBe('Week of May 10');
        expect(
            statsBucketLabelInTimeZone(instant, 'year', 'America/New_York')
        ).toBe('2026');
        expect(
            addStatsBucketStepInTimeZone(instant, 'week', 'America/New_York')
        ).toEqual(new Date('2026-05-17T04:00:00.000Z'));
        expect(
            addStatsBucketStepInTimeZone(instant, 'year', 'America/New_York')
        ).toEqual(new Date('2027-01-01T05:00:00.000Z'));
        expect(
            localDayDifference(
                '2026-05-10T13:30:00.000Z',
                '2026-05-12T13:30:00.000Z',
                'America/New_York'
            )
        ).toBe(2);
        expect(localHour(instant, 'America/New_York')).toBe(9);
        expect(localMonthIndex(instant, 'America/New_York')).toBe(4);
    });
});
