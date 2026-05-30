import { notFound } from 'next/navigation';
import { CategoryTrendExplorer } from '@/components/category-trend-explorer';
import { getApiClient } from '@/lib/api';
import {
    type CategoryTrendSearchParams,
    categoryTrendParamValue,
    categoryTrendQuery
} from '@/lib/category-trend-query';

type CategoryTrendPageParams = {
    readonly categoryId: string;
};

function parseCategoryId(value: string): number | undefined {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : undefined;
}

function readParam(
    params: CategoryTrendSearchParams,
    key: keyof CategoryTrendSearchParams
) {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
}

function isBadRequestApiError(err: unknown): boolean {
    return (
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        err.status === 400
    );
}

export const dynamic = 'force-dynamic';

export default async function CategoryTrendPage({
    params,
    searchParams
}: {
    readonly params: Promise<CategoryTrendPageParams>;
    readonly searchParams: Promise<CategoryTrendSearchParams>;
}) {
    const [{ categoryId }, rawSearchParams] = await Promise.all([
        params,
        searchParams
    ]);
    const selectedCategoryId = parseCategoryId(categoryId);
    if (!selectedCategoryId) {
        notFound();
    }

    const client = await getApiClient();
    const me = await client.auth.me();
    const query = categoryTrendQuery(rawSearchParams, me.timezone);
    const [categories, trend] = await Promise.all([
        client.categories.list({ query: {} }),
        client.stats
            .categoryTrend({
                params: { id: selectedCategoryId },
                query
            })
            .catch(err => {
                if (isBadRequestApiError(err)) {
                    notFound();
                }
                throw err;
            })
    ]);

    return (
        <CategoryTrendExplorer
            categories={categories}
            currentQuery={{
                range: query.range ?? trend.range,
                groupBy: query.groupBy ?? trend.groupBy,
                from:
                    readParam(rawSearchParams, 'from') ??
                    categoryTrendParamValue(trend.from, me.timezone),
                to:
                    readParam(rawSearchParams, 'to') ??
                    categoryTrendParamValue(trend.to, me.timezone)
            }}
            timezone={me.timezone}
            trend={trend}
        />
    );
}
