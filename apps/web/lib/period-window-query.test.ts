import { describe, expect, it } from 'vitest';
import {
    dashboardPeriodWindowQuery,
    periodWindowQuery
} from './period-window-query';

describe('period window query helpers', () => {
    it('keeps merchant limits dashboard-specific', () => {
        const params = new URLSearchParams({
            after: '1',
            before: '3',
            merchantLimit: '100',
            period: 'month'
        });

        expect(periodWindowQuery(params, 'UTC')).toEqual({
            after: 1,
            before: 3,
            period: 'month'
        });
        expect(dashboardPeriodWindowQuery(params, 'UTC')).toEqual({
            after: 1,
            before: 3,
            merchantLimit: 100,
            period: 'month'
        });
    });
});
