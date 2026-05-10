'use client';

import { Field, FieldLabel, Input } from '@xpenser/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    type ReportGroupBy,
    type ReportTimeframe,
    reportGroupByOptions,
    reportTimeframeOptions
} from '@/lib/report-filters';

function formatDateInput(value?: string): string {
    return value && !Number.isNaN(new Date(value).getTime()) ? value : '';
}

export function ReportsFilters({
    groupBy,
    timeframe,
    from,
    to
}: {
    readonly groupBy: ReportGroupBy;
    readonly timeframe: ReportTimeframe;
    readonly from?: string;
    readonly to?: string;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    function updateFilter(key: string, value: string) {
        const params = new URLSearchParams(searchParams);
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }

        if (key === 'timeframe' && value !== 'custom') {
            params.delete('from');
            params.delete('to');
        }

        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, {
            scroll: false
        });
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[160px_180px_140px_140px] lg:items-end">
            <Field>
                <FieldLabel htmlFor="groupBy">Group by</FieldLabel>
                <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    id="groupBy"
                    onChange={event =>
                        updateFilter('groupBy', event.target.value)
                    }
                    value={groupBy}
                >
                    {reportGroupByOptions.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </Field>
            <Field>
                <FieldLabel htmlFor="timeframe">Timeframe</FieldLabel>
                <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    id="timeframe"
                    onChange={event =>
                        updateFilter('timeframe', event.target.value)
                    }
                    value={timeframe}
                >
                    {reportTimeframeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </Field>
            {timeframe === 'custom' ? (
                <>
                    <Field>
                        <FieldLabel htmlFor="from">From</FieldLabel>
                        <Input
                            id="from"
                            onChange={event =>
                                updateFilter('from', event.target.value)
                            }
                            type="date"
                            value={formatDateInput(from)}
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="to">To</FieldLabel>
                        <Input
                            id="to"
                            onChange={event =>
                                updateFilter('to', event.target.value)
                            }
                            type="date"
                            value={formatDateInput(to)}
                        />
                    </Field>
                </>
            ) : null}
        </div>
    );
}
