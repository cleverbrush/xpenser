import type { TransactionListQuery } from '@xpenser/contracts';
import { defaultTimeZone, localDateParamToDate } from '@xpenser/timezone';

export const transactionPageSize = 30;

export type TransactionSearchParams = {
    readonly search?: string | readonly string[];
    readonly type?: string | readonly string[];
    readonly categoryId?: string | readonly string[];
    readonly from?: string | readonly string[];
    readonly to?: string | readonly string[];
    readonly page?: string | readonly string[];
    readonly limit?: string | readonly string[];
    readonly direction?: string | readonly string[];
};

type QuerySource = TransactionSearchParams | URLSearchParams;

function readParam(params: QuerySource, key: keyof TransactionSearchParams) {
    if (params instanceof URLSearchParams) {
        return params.get(key) ?? undefined;
    }

    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
}

export function parseTransactionType(
    value?: string
): 'expense' | 'income' | undefined {
    return value === 'expense' || value === 'income' ? value : undefined;
}

export function parseTransactionId(value?: string): number | undefined {
    if (!value) {
        return undefined;
    }

    const id = Number(value);
    return Number.isFinite(id) && id > 0 ? id : undefined;
}

export function parseTransactionDateFilter(
    value: string | undefined,
    boundary: 'end' | 'start',
    timeZone = defaultTimeZone
): Date | undefined {
    return localDateParamToDate(value, timeZone, boundary);
}

function parsePositiveInteger(
    value: string | undefined,
    fallback: number
): number {
    if (!value) {
        return fallback;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function hasTransactionFilters(params: QuerySource): boolean {
    return Boolean(
        readParam(params, 'search')?.trim() ||
            parseTransactionType(readParam(params, 'type')) ||
            parseTransactionId(readParam(params, 'categoryId')) ||
            readParam(params, 'from') ||
            readParam(params, 'to')
    );
}

export function buildTransactionListQuery(
    params: QuerySource,
    overrides: {
        readonly page?: number;
        readonly limit?: number;
    } = {},
    timeZone = defaultTimeZone
): TransactionListQuery {
    const search = readParam(params, 'search')?.trim();
    const direction = readParam(params, 'direction') === 'asc' ? 'asc' : 'desc';

    return {
        search: search || undefined,
        type: parseTransactionType(readParam(params, 'type')),
        categoryId: parseTransactionId(readParam(params, 'categoryId')),
        from: parseTransactionDateFilter(
            readParam(params, 'from'),
            'start',
            timeZone
        ),
        to: parseTransactionDateFilter(
            readParam(params, 'to'),
            'end',
            timeZone
        ),
        page:
            overrides.page ??
            parsePositiveInteger(readParam(params, 'page'), 1),
        limit:
            overrides.limit ??
            parsePositiveInteger(
                readParam(params, 'limit'),
                transactionPageSize
            ),
        direction
    };
}

export function transactionHasMore({
    total,
    page,
    limit
}: {
    readonly total: number;
    readonly page: number;
    readonly limit: number;
}): boolean {
    return page * limit < total;
}
