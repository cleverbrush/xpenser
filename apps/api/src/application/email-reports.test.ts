import { describe, expect, it } from 'vitest';
import { dueEmailReportTypes, emailReportPeriod } from './email-reports.js';

describe('email report periods', () => {
    it('uses the previous complete local week for weekly reports', () => {
        const period = emailReportPeriod(
            'weekly',
            new Date('2026-06-01T13:00:00.000Z'),
            'UTC'
        );

        expect(period.from).toEqual(new Date('2026-05-25T00:00:00.000Z'));
        expect(period.to).toEqual(new Date('2026-05-31T23:59:59.999Z'));
    });

    it('uses the previous complete local month for monthly reports', () => {
        const period = emailReportPeriod(
            'monthly',
            new Date('2026-06-01T13:00:00.000Z'),
            'UTC'
        );

        expect(period.from).toEqual(new Date('2026-05-01T00:00:00.000Z'));
        expect(period.to).toEqual(new Date('2026-05-31T23:59:59.999Z'));
    });
});

describe('email report due checks', () => {
    it('sends weekly reports on Monday after the local delivery hour', () => {
        expect(
            dueEmailReportTypes(
                {
                    timezone: 'UTC',
                    weeklyEmailReportEnabled: true,
                    monthlyEmailReportEnabled: true
                },
                new Date('2026-06-01T08:05:00.000Z'),
                8
            )
        ).toEqual(['weekly', 'monthly']);
    });

    it('does not send before the local delivery hour', () => {
        expect(
            dueEmailReportTypes(
                {
                    timezone: 'UTC',
                    weeklyEmailReportEnabled: true,
                    monthlyEmailReportEnabled: true
                },
                new Date('2026-06-01T07:59:00.000Z'),
                8
            )
        ).toEqual([]);
    });

    it('respects disabled user preferences', () => {
        expect(
            dueEmailReportTypes(
                {
                    timezone: 'UTC',
                    weeklyEmailReportEnabled: false,
                    monthlyEmailReportEnabled: true
                },
                new Date('2026-06-01T08:05:00.000Z'),
                8
            )
        ).toEqual(['monthly']);
    });
});
