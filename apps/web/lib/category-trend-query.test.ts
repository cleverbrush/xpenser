import { describe, expect, it } from 'vitest';
import {
    categoryTrendHref,
    categoryTrendParamValue,
    categoryTrendQuery
} from './category-trend-query';

describe('category trend query helpers', () => {
    it('defaults to last twelve months with monthly buckets', () => {
        expect(categoryTrendQuery(new URLSearchParams())).toEqual({
            groupBy: 'month',
            range: 'last-12-months'
        });
    });

    it('parses custom date ranges in the user timezone', () => {
        const query = categoryTrendQuery(
            new URLSearchParams({
                from: '2026-05-10',
                groupBy: 'week',
                range: 'custom',
                to: '2026-05-20'
            }),
            'America/Los_Angeles'
        );

        expect(query).toEqual({
            from: new Date('2026-05-10T07:00:00.000Z'),
            groupBy: 'week',
            range: 'custom',
            to: new Date('2026-05-21T06:59:59.999Z')
        });
    });

    it('builds category trend hrefs without stale custom dates', () => {
        expect(
            categoryTrendHref(7, {
                from: '2026-05-01',
                groupBy: 'day',
                range: 'last-30-days',
                to: '2026-05-30'
            })
        ).toBe('/stats/categories/7?groupBy=day&range=last-30-days');
        expect(
            categoryTrendHref(7, {
                from: '2026-05-01',
                groupBy: 'day',
                range: 'custom',
                to: '2026-05-30'
            })
        ).toBe(
            '/stats/categories/7?groupBy=day&range=custom&from=2026-05-01&to=2026-05-30'
        );
    });

    it('formats trend dates as local date params', () => {
        expect(
            categoryTrendParamValue(
                new Date('2026-05-10T06:30:00.000Z'),
                'America/Los_Angeles'
            )
        ).toBe('2026-05-09');
    });
});
