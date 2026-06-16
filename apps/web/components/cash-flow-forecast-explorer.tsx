'use client';

import type {
    CashFlowForecastResponse,
    CashFlowForecastWindow,
    CashFlowRecurringPattern
} from '@xpenser/contracts';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    cn
} from '@xpenser/ui';
import {
    AlertTriangleIcon,
    CalendarRangeIcon,
    RepeatIcon,
    SparklesIcon
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { AmountDisplay } from '@/components/amount-display';
import { formatDate, formatMoney } from '@/lib/format';

type Horizon = CashFlowForecastWindow['horizonDays'];
type TooltipPayload = {
    readonly color?: string;
    readonly name?: string;
    readonly value?: number | string;
};

const incomeColor = '#047857';
const expenseColor = '#be123c';
const netColor = 'hsl(var(--accent))';

function forecastWindow(
    forecast: CashFlowForecastResponse,
    horizon: Horizon
): CashFlowForecastWindow {
    return (
        forecast.windows.find(window => window.horizonDays === horizon) ??
        forecast.windows[0]!
    );
}

function confidenceBadgeClassName(confidence: string): string {
    if (confidence === 'high') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300';
    }
    if (confidence === 'medium') {
        return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300';
    }
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300';
}

function ChartTooltip({
    active,
    currency,
    label,
    payload
}: {
    readonly active?: boolean;
    readonly currency: string;
    readonly label?: string | number;
    readonly payload?: readonly TooltipPayload[];
}) {
    if (!active || !payload?.length) {
        return null;
    }

    return (
        <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-sm">
            <p className="mb-1 font-medium">{label}</p>
            <div className="flex flex-col gap-1">
                {payload.map(item => (
                    <div
                        className="flex items-center justify-between gap-4"
                        key={item.name}
                    >
                        <span style={{ color: item.color }}>{item.name}</span>
                        <span className="font-medium">
                            {typeof item.value === 'number'
                                ? formatMoney(item.value, currency)
                                : item.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ForecastChart({
    currency,
    window
}: {
    readonly currency: string;
    readonly window: CashFlowForecastWindow;
}) {
    const data = window.buckets.map(bucket => ({
        label: bucket.label,
        Income: bucket.incomeTotal,
        Expenses: -bucket.expenseTotal,
        Net: bucket.netTotal
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Weekly forecast</CardTitle>
                <CardDescription>
                    Baseline averages plus detected recurring patterns.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-72">
                    <ResponsiveContainer height="100%" width="100%">
                        <BarChart data={data}>
                            <CartesianGrid
                                stroke="hsl(var(--border))"
                                strokeDasharray="3 3"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="label"
                                fontSize={12}
                                stroke="hsl(var(--muted-foreground))"
                                tickLine={false}
                            />
                            <YAxis
                                fontSize={12}
                                stroke="hsl(var(--muted-foreground))"
                                tickFormatter={value =>
                                    Number(value).toLocaleString('en-US', {
                                        maximumFractionDigits: 0
                                    })
                                }
                                tickLine={false}
                                width={48}
                            />
                            <ReferenceLine stroke="hsl(var(--border))" y={0} />
                            <Tooltip
                                content={<ChartTooltip currency={currency} />}
                            />
                            <Bar
                                dataKey="Income"
                                fill={incomeColor}
                                radius={[4, 4, 0, 0]}
                            />
                            <Bar
                                dataKey="Expenses"
                                fill={expenseColor}
                                radius={[0, 0, 4, 4]}
                            />
                            <Bar dataKey="Net" fill={netColor} radius={4} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

function MetricCard({
    label,
    value,
    detail
}: {
    readonly detail: string;
    readonly label: string;
    readonly value: ReactNode;
}) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-xs text-muted-foreground">{detail}</p>
            </CardContent>
        </Card>
    );
}

function RecurringPatternRow({
    currency,
    pattern
}: {
    readonly currency: string;
    readonly pattern: CashFlowRecurringPattern;
}) {
    return (
        <div className="grid gap-3 border-t py-3 text-sm first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                    <RepeatIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">
                        {pattern.vendorName ??
                            pattern.note ??
                            pattern.categoryDisplayName}
                    </span>
                    <Badge
                        className={confidenceBadgeClassName(pattern.confidence)}
                        variant="outline"
                    >
                        {pattern.confidence}
                    </Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                    {pattern.categoryDisplayName} - {pattern.cadence},{' '}
                    {pattern.occurrenceCount} historical occurrences
                </p>
            </div>
            <div className="text-left sm:text-right">
                <div className="font-medium">
                    {formatMoney(
                        pattern.type === 'expense'
                            ? -pattern.amount
                            : pattern.amount,
                        currency
                    )}
                </div>
                <p className="text-muted-foreground">
                    {pattern.projectedCount} next 90 days
                </p>
            </div>
        </div>
    );
}

function ForecastInsights({
    forecast
}: {
    readonly forecast: CashFlowForecastResponse;
}) {
    if (forecast.insightsStatus === 'available' && forecast.insights) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <SparklesIcon className="size-5 text-accent" />
                        <CardTitle>{forecast.insights.headline}</CardTitle>
                    </div>
                    <CardDescription>
                        {forecast.insights.summary}
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    <InsightList
                        items={forecast.insights.risks}
                        title="Risks"
                    />
                    <InsightList
                        items={forecast.insights.opportunities}
                        title="Opportunities"
                    />
                    <InsightList
                        items={forecast.insights.recurringNotes}
                        title="Recurring"
                    />
                    <InsightList
                        items={forecast.insights.actions}
                        title="Actions"
                    />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <AlertTriangleIcon className="size-5 text-muted-foreground" />
                    <CardTitle>AI insight unavailable</CardTitle>
                </div>
                <CardDescription>
                    The deterministic forecast is still available. AI summaries
                    require OpenAI configuration and must complete within the
                    request timeout.
                </CardDescription>
            </CardHeader>
        </Card>
    );
}

function InsightList({
    items,
    title
}: {
    readonly items: readonly string[];
    readonly title: string;
}) {
    return (
        <div>
            <h3 className="text-sm font-medium">{title}</h3>
            {items.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                    {items.map(item => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                    No specific items.
                </p>
            )}
        </div>
    );
}

export function CashFlowForecastExplorer({
    forecast,
    timezone
}: {
    readonly forecast: CashFlowForecastResponse;
    readonly timezone: string;
}) {
    const [horizon, setHorizon] = useState<Horizon>(30);
    const selectedWindow = useMemo(
        () => forecastWindow(forecast, horizon),
        [forecast, horizon]
    );
    const recurringPatterns = forecast.recurringPatterns.filter(
        pattern => pattern.projectedCount > 0
    );

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">
                        Cash-flow forecast
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {formatDate(selectedWindow.from, timezone)} -{' '}
                        {formatDate(selectedWindow.to, timezone)} in{' '}
                        {forecast.currency}.
                    </p>
                </div>
                <div className="inline-grid grid-cols-2 rounded-md border bg-muted/35 p-1">
                    {([30, 90] as const).map(value => (
                        <Button
                            aria-pressed={horizon === value}
                            className={cn(
                                'min-w-24 justify-center',
                                horizon !== value && 'text-muted-foreground'
                            )}
                            key={value}
                            onClick={() => setHorizon(value)}
                            size="sm"
                            type="button"
                            variant={horizon === value ? 'default' : 'ghost'}
                        >
                            <CalendarRangeIcon className="size-4" />
                            {value} days
                        </Button>
                    ))}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    detail={`${formatMoney(
                        selectedWindow.averageDailyNet,
                        forecast.currency
                    )} average daily net`}
                    label="Projected net"
                    value={
                        <AmountDisplay
                            currency={forecast.currency}
                            value={selectedWindow.netTotal}
                        />
                    }
                />
                <MetricCard
                    detail={`${formatMoney(
                        selectedWindow.recurringIncomeTotal,
                        forecast.currency
                    )} from recurring patterns`}
                    label="Projected income"
                    value={
                        <AmountDisplay
                            currency={forecast.currency}
                            value={selectedWindow.incomeTotal}
                        />
                    }
                />
                <MetricCard
                    detail={`${formatMoney(
                        selectedWindow.recurringExpenseTotal,
                        forecast.currency
                    )} from recurring patterns`}
                    label="Projected expenses"
                    value={
                        <AmountDisplay
                            currency={forecast.currency}
                            value={-selectedWindow.expenseTotal}
                        />
                    }
                />
                <MetricCard
                    detail={`${selectedWindow.projectedRecurringCount} projected recurring occurrences`}
                    label="Confidence"
                    value={
                        <Badge
                            className={confidenceBadgeClassName(
                                selectedWindow.confidence
                            )}
                            variant="outline"
                        >
                            {selectedWindow.confidence}
                        </Badge>
                    }
                />
            </div>

            <ForecastInsights forecast={forecast} />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
                <ForecastChart
                    currency={forecast.currency}
                    window={selectedWindow}
                />
                <Card>
                    <CardHeader>
                        <CardTitle>Recurring patterns</CardTitle>
                        <CardDescription>
                            Detected from repeated category, vendor or note,
                            amount stability, and cadence.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {recurringPatterns.length > 0 ? (
                            recurringPatterns.map(pattern => (
                                <RecurringPatternRow
                                    currency={forecast.currency}
                                    key={pattern.id}
                                    pattern={pattern}
                                />
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No recurring patterns were detected in the
                                history window.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
