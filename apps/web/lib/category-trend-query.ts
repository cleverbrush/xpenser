import type {
    CategoryTrendGroupBy,
    CategoryTrendQuery,
    CategoryTrendRange
} from '@xpenser/contracts';
import {
    dateToLocalDateParam,
    defaultTimeZone,
    localDateParamToDate
} from '@xpenser/timezone';

export const categoryTrendRangeOptions = [
    { value: 'last-30-days', label: '30 days' },
    { value: 'last-90-days', label: '90 days' },
    { value: 'this-year', label: 'This year' },
    { value: 'last-12-months', label: '12 months' },
    { value: 'all-time', label: 'All time' },
    { value: 'custom', label: 'Custom' }
] as const satisfies readonly {
    readonly value: CategoryTrendRange;
    readonly label: string;
}[];

export const categoryTrendGroupByOptions = [
    { value: 'day', label: 'Daily' },
    { value: 'week', label: 'Weekly' },
    { value: 'month', label: 'Monthly' },
    { value: 'year', label: 'Yearly' }
] as const satisfies readonly {
    readonly value: CategoryTrendGroupBy;
    readonly label: string;
}[];

const categoryTrendRanges = categoryTrendRangeOptions.map(
    option => option.value
);
const categoryTrendGroups = categoryTrendGroupByOptions.map(
    option => option.value
);

export type CategoryTrendSearchParams = {
    readonly range?: string | readonly string[];
    readonly groupBy?: string | readonly string[];
    readonly from?: string | readonly string[];
    readonly to?: string | readonly string[];
};

type QuerySource = CategoryTrendSearchParams | URLSearchParams;

function readParam(params: QuerySource, key: keyof CategoryTrendSearchParams) {
    if (params instanceof URLSearchParams) {
        return params.get(key) ?? undefined;
    }

    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
}

export function isCategoryTrendRange(
    value?: string
): value is CategoryTrendRange {
    return categoryTrendRanges.includes(value as CategoryTrendRange);
}

export function isCategoryTrendGroupBy(
    value?: string
): value is CategoryTrendGroupBy {
    return categoryTrendGroups.includes(value as CategoryTrendGroupBy);
}

export function categoryTrendQuery(
    params: QuerySource,
    timeZone = defaultTimeZone
): CategoryTrendQuery {
    const rangeParam = readParam(params, 'range');
    const groupParam = readParam(params, 'groupBy');
    const range = isCategoryTrendRange(rangeParam)
        ? rangeParam
        : 'last-12-months';
    const groupBy = isCategoryTrendGroupBy(groupParam) ? groupParam : 'month';
    const from = localDateParamToDate(
        readParam(params, 'from'),
        timeZone,
        'start'
    );
    const to = localDateParamToDate(readParam(params, 'to'), timeZone, 'end');

    return {
        range,
        groupBy,
        ...(range === 'custom' && from && to ? { from, to } : {})
    };
}

export function categoryTrendParamValue(
    value: Date | string | number | undefined,
    timeZone = defaultTimeZone
): string | undefined {
    return value ? dateToLocalDateParam(value, timeZone) : undefined;
}

export function categoryTrendHref(
    categoryId: number,
    query: {
        readonly range: CategoryTrendRange;
        readonly groupBy: CategoryTrendGroupBy;
        readonly from?: string;
        readonly to?: string;
    }
): string {
    const params = new URLSearchParams({
        groupBy: query.groupBy,
        range: query.range
    });
    if (query.range === 'custom') {
        if (query.from) {
            params.set('from', query.from);
        }
        if (query.to) {
            params.set('to', query.to);
        }
    }

    return `/stats/categories/${categoryId}?${params.toString()}`;
}
