import { describe, expect, it } from 'vitest';
import {
    dateParam,
    formatDashboardRangeLabel,
    isLatestDashboardPeriod,
    parseDateParam
} from './dashboard-periods';

describe('dashboard period helpers', () => {
    it('parses only valid date params', () => {
        expect(parseDateParam('2026-05-14')).toEqual(new Date(2026, 4, 14));
        expect(parseDateParam('2026-02-31')).toBeUndefined();
    });

    it('formats date params in the selected timezone', () => {
        const instant = new Date('2026-05-10T06:30:00.000Z');

        expect(dateParam(instant, 'America/Los_Angeles')).toBe('2026-05-09');
        expect(parseDateParam('2026-05-09', 'America/Los_Angeles')).toEqual(
            new Date('2026-05-09T07:00:00.000Z')
        );
    });

    it('formats current-year period labels without the year', () => {
        const now = new Date(2026, 4, 14, 12, 0, 0, 0);

        expect(
            formatDashboardRangeLabel({
                from: new Date(2026, 4, 5),
                period: 'day',
                to: new Date(2026, 4, 5),
                now
            })
        ).toBe('5 May');
        expect(
            formatDashboardRangeLabel({
                from: new Date(2026, 4, 10),
                period: 'week',
                to: new Date(2026, 4, 17),
                now
            })
        ).toBe('10 May - 17 May');
        expect(
            formatDashboardRangeLabel({
                from: new Date(2026, 4, 1),
                period: 'month',
                to: new Date(2026, 4, 31),
                now
            })
        ).toBe('May');
    });

    it('includes years for older period labels', () => {
        const now = new Date(2026, 4, 14, 12, 0, 0, 0);

        expect(
            formatDashboardRangeLabel({
                from: new Date(2025, 4, 5),
                period: 'day',
                to: new Date(2025, 4, 5),
                now
            })
        ).toBe('5 May 2025');
        expect(
            formatDashboardRangeLabel({
                from: new Date(2025, 4, 1),
                period: 'month',
                to: new Date(2025, 4, 31),
                now
            })
        ).toBe('May 2025');
        expect(
            formatDashboardRangeLabel({
                from: new Date(2025, 3, 1),
                period: 'quarter',
                to: new Date(2025, 5, 30),
                now
            })
        ).toBe('Q2 2025');
    });

    it('detects whether a selected date belongs to the latest period', () => {
        const now = new Date(2026, 4, 14, 12, 0, 0, 0);

        expect(
            isLatestDashboardPeriod('week', new Date(2026, 4, 11), now)
        ).toBe(true);
        expect(isLatestDashboardPeriod('week', new Date(2026, 4, 4), now)).toBe(
            false
        );
    });
});
