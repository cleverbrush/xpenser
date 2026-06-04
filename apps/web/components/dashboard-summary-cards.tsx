import type { DashboardSummary } from '@xpenser/contracts';
import { Card, CardDescription, CardHeader, CardTitle } from '@xpenser/ui';
import Link from 'next/link';
import { AmountDisplay } from '@/components/amount-display';
import { dateParam } from '@/lib/dashboard-periods';
import {
    amountClassNameForCategoryTotal,
    amountClassNameForValue,
    signedCategoryTotal
} from '@/lib/format';

type AggregateType = DashboardSummary['byCategory'][number]['type'];

function aggregateHref(
    summary: DashboardSummary,
    type: AggregateType,
    timezone: string
): string {
    const params = new URLSearchParams({
        type,
        from: dateParam(summary.from, timezone),
        to: dateParam(summary.to, timezone)
    });
    return `/transactions?${params.toString()}`;
}

function AggregateCard({
    summary,
    timezone,
    title,
    type,
    value
}: {
    readonly summary: DashboardSummary;
    readonly timezone: string;
    readonly title: string;
    readonly type: AggregateType;
    readonly value: number;
}) {
    return (
        <Link
            aria-label={`View ${title.toLowerCase()} transactions for this period`}
            className="block min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            draggable={false}
            href={aggregateHref(summary, type, timezone)}
            prefetch={false}
        >
            <Card className="h-full min-w-0 transition-colors hover:bg-muted/40">
                <CardHeader className="min-w-0 p-3 sm:p-4">
                    <CardDescription className="text-xs">
                        {title}
                    </CardDescription>
                    <CardTitle
                        className={`truncate text-sm sm:text-lg ${amountClassNameForCategoryTotal(value, type)}`}
                    >
                        <AmountDisplay
                            currency={summary.currency}
                            value={signedCategoryTotal(value, type)}
                        />
                    </CardTitle>
                </CardHeader>
            </Card>
        </Link>
    );
}

export function DashboardSummaryCards({
    summary,
    timezone
}: {
    readonly summary: DashboardSummary;
    readonly timezone: string;
}) {
    return (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <AggregateCard
                summary={summary}
                timezone={timezone}
                title="Income"
                type="income"
                value={summary.incomeTotal}
            />
            <AggregateCard
                summary={summary}
                timezone={timezone}
                title="Expenses"
                type="expense"
                value={summary.expenseTotal}
            />
            <Card className="min-w-0">
                <CardHeader className="min-w-0 p-3 sm:p-4">
                    <CardDescription className="text-xs">Net</CardDescription>
                    <CardTitle
                        className={`truncate text-sm sm:text-lg ${amountClassNameForValue(
                            summary.incomeTotal - summary.expenseTotal
                        )}`}
                    >
                        <AmountDisplay
                            currency={summary.currency}
                            value={summary.incomeTotal - summary.expenseTotal}
                        />
                    </CardTitle>
                </CardHeader>
            </Card>
        </div>
    );
}
