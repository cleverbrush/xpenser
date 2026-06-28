import { dateParam } from './dashboard-periods';

type DateInput = Date | string | number;

export function transactionExportHref({
    extraParams,
    from,
    timezone,
    to
}: {
    readonly extraParams?: Readonly<Record<string, string | undefined>>;
    readonly from?: DateInput;
    readonly timezone: string;
    readonly to?: DateInput;
}): string {
    const params = new URLSearchParams();
    if (from) {
        params.set('from', dateParam(from, timezone));
    }
    if (to) {
        params.set('to', dateParam(to, timezone));
    }
    for (const [key, value] of Object.entries(extraParams ?? {})) {
        if (value) {
            params.set(key, value);
        }
    }

    const query = params.toString();
    return query
        ? `/app-api/transactions/export.csv?${query}`
        : '/app-api/transactions/export.csv';
}
