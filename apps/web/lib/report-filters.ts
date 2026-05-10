export const reportGroupByOptions = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' }
] as const;

export const reportTimeframeOptions = [
    { value: 'this-week', label: 'This week' },
    { value: 'last-7-days', label: 'Last 7 days' },
    { value: 'this-month', label: 'This month' },
    { value: 'last-month', label: 'Last month' },
    { value: 'last-30-days', label: 'Last 30 days' },
    { value: 'custom', label: 'Custom interval' }
] as const;

export type ReportGroupBy = (typeof reportGroupByOptions)[number]['value'];
export type ReportTimeframe = (typeof reportTimeframeOptions)[number]['value'];

export function isReportGroupBy(value?: string): value is ReportGroupBy {
    return reportGroupByOptions.some(option => option.value === value);
}

export function isReportTimeframe(value?: string): value is ReportTimeframe {
    return reportTimeframeOptions.some(option => option.value === value);
}
