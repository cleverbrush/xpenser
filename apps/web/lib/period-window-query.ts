import type { DashboardSummary } from '@xpenser/contracts';
import { isDashboardPeriod, parseDateParam } from './dashboard-periods';

type DashboardPeriod = DashboardSummary['period'];

export function periodWindowQuery(
    params: URLSearchParams,
    timezone: string
): {
    readonly after: number;
    readonly before: number;
    readonly date?: Date;
    readonly period: DashboardPeriod;
} {
    const periodParam = params.get('period') ?? undefined;
    const dateParam = params.get('date') ?? undefined;
    const beforeParam = params.get('before') ?? undefined;
    const afterParam = params.get('after') ?? undefined;
    const before = beforeParam ? Number(beforeParam) : Number.NaN;
    const after = afterParam ? Number(afterParam) : Number.NaN;
    const date = dateParam ? parseDateParam(dateParam, timezone) : undefined;

    return {
        after: Number.isFinite(after) ? after : 2,
        before: Number.isFinite(before) ? before : 2,
        period: isDashboardPeriod(periodParam) ? periodParam : 'day',
        ...(date ? { date } : undefined)
    };
}

export function dashboardPeriodWindowQuery(
    params: URLSearchParams,
    timezone: string
): ReturnType<typeof periodWindowQuery> & {
    readonly currency?: string;
    readonly vendorLimit?: number;
} {
    const base = periodWindowQuery(params, timezone);
    const currencyParam = params.get('currency') ?? undefined;
    const currency = currencyParam?.trim().toUpperCase();
    const vendorLimitParam = params.get('vendorLimit') ?? undefined;
    const vendorLimit = vendorLimitParam
        ? Number(vendorLimitParam)
        : Number.NaN;

    return {
        ...base,
        ...(currency && /^[A-Z]{3}$/.test(currency) ? { currency } : undefined),
        ...(Number.isFinite(vendorLimit) ? { vendorLimit } : undefined)
    };
}
