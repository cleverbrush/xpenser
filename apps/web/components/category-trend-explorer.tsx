'use client';

import type {
    Category,
    CategoryTrendGroupBy,
    CategoryTrendRange,
    CategoryTrendResponse
} from '@xpenser/contracts';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    cn,
    Field,
    FieldLabel,
    Input
} from '@xpenser/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { AmountDisplay } from '@/components/amount-display';
import {
    categoryTrendGroupByOptions,
    categoryTrendHref,
    categoryTrendParamValue,
    categoryTrendRangeOptions
} from '@/lib/category-trend-query';
import {
    amountClassNameForCategoryTotal,
    formatMoney,
    signedCategoryTotal
} from '@/lib/format';

const incomeColor = '#047857';
const expenseColor = '#be123c';

type TrendPoint = CategoryTrendResponse['trend'][number];
type QueryState = {
    readonly range: CategoryTrendRange;
    readonly groupBy: CategoryTrendGroupBy;
    readonly from?: string;
    readonly to?: string;
};
type TooltipPayload = {
    readonly color?: string;
    readonly name?: string;
    readonly value?: number | string;
};
type ChartPoint = {
    readonly label: string;
    readonly Amount: number;
    readonly Transactions: number;
    readonly href: string;
    readonly bucket: string;
};

function trendTransactionHref(
    trend: CategoryTrendResponse,
    point: TrendPoint,
    timezone: string
): string {
    const params = new URLSearchParams({
        categoryId: String(trend.categoryId),
        from: categoryTrendParamValue(point.from, timezone) ?? '',
        to: categoryTrendParamValue(point.to, timezone) ?? '',
        type: trend.type
    });
    return `/transactions?${params.toString()}`;
}

function barHref(value: unknown): string | undefined {
    if (typeof value !== 'object' || value === null || !('payload' in value)) {
        return undefined;
    }

    const payload = (
        value as { readonly payload?: { readonly href?: unknown } }
    ).payload;
    return typeof payload?.href === 'string' ? payload.href : undefined;
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

function CategorySelector({
    categories,
    currentQuery,
    selectedCategoryId
}: {
    readonly categories: readonly Category[];
    readonly currentQuery: QueryState;
    readonly selectedCategoryId: number;
}) {
    const router = useRouter();

    return (
        <select
            aria-label="Category"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            id="category-trend-category"
            onChange={event => {
                router.push(
                    categoryTrendHref(Number(event.target.value), currentQuery)
                );
            }}
            value={selectedCategoryId}
        >
            {categories.map(category => (
                <option key={category.id} value={category.id}>
                    {category.name} ({category.type})
                </option>
            ))}
        </select>
    );
}

function SegmentLink({
    active,
    children,
    href
}: {
    readonly active: boolean;
    readonly children: React.ReactNode;
    readonly href: string;
}) {
    return (
        <Button
            asChild
            className={cn(
                'min-w-0 justify-center px-2',
                !active && 'text-muted-foreground'
            )}
            data-state={active ? 'on' : 'off'}
            size="sm"
            variant={active ? 'default' : 'ghost'}
        >
            <Link aria-current={active ? 'page' : undefined} href={href}>
                {children}
            </Link>
        </Button>
    );
}

function CustomDateRangeFields({
    currentQuery,
    timezone,
    trend
}: {
    readonly currentQuery: QueryState;
    readonly timezone: string;
    readonly trend: CategoryTrendResponse;
}) {
    const router = useRouter();
    const customFrom =
        currentQuery.from ?? categoryTrendParamValue(trend.from, timezone);
    const customTo =
        currentQuery.to ?? categoryTrendParamValue(trend.to, timezone);
    const [from, setFrom] = useState(customFrom ?? '');
    const [to, setTo] = useState(customTo ?? '');

    useEffect(() => {
        setFrom(customFrom ?? '');
        setTo(customTo ?? '');
    }, [customFrom, customTo]);

    function replaceRange(nextFrom: string, nextTo: string) {
        if (!nextFrom || !nextTo) {
            return;
        }

        router.replace(
            categoryTrendHref(trend.categoryId, {
                ...currentQuery,
                range: 'custom',
                groupBy: trend.groupBy,
                from: nextFrom,
                to: nextTo
            }),
            { scroll: false }
        );
    }

    return (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 sm:max-w-md">
            <Field className="min-w-0">
                <FieldLabel htmlFor="category-trend-from">From</FieldLabel>
                <Input
                    className="min-w-0"
                    id="category-trend-from"
                    onChange={event => {
                        const nextFrom = event.target.value;
                        setFrom(nextFrom);
                        replaceRange(nextFrom, to);
                    }}
                    type="date"
                    value={from}
                />
            </Field>
            <Field className="min-w-0">
                <FieldLabel htmlFor="category-trend-to">To</FieldLabel>
                <Input
                    className="min-w-0"
                    id="category-trend-to"
                    onChange={event => {
                        const nextTo = event.target.value;
                        setTo(nextTo);
                        replaceRange(from, nextTo);
                    }}
                    type="date"
                    value={to}
                />
            </Field>
        </div>
    );
}

function TrendControls({
    categories,
    currentQuery,
    timezone,
    trend
}: {
    readonly categories: readonly Category[];
    readonly currentQuery: QueryState;
    readonly timezone: string;
    readonly trend: CategoryTrendResponse;
}) {
    return (
        <section className="rounded-md border bg-card p-3">
            <div className="grid gap-3 xl:grid-cols-[minmax(240px,320px)_minmax(0,1fr)_minmax(180px,260px)]">
                <Field>
                    <FieldLabel>Bucket</FieldLabel>
                    <div className="grid grid-cols-4 gap-1 rounded-md border bg-muted p-1">
                        {categoryTrendGroupByOptions.map(option => (
                            <SegmentLink
                                active={trend.groupBy === option.value}
                                href={categoryTrendHref(trend.categoryId, {
                                    ...currentQuery,
                                    groupBy: option.value
                                })}
                                key={option.value}
                            >
                                {option.label}
                            </SegmentLink>
                        ))}
                    </div>
                </Field>
                <Field>
                    <FieldLabel>Timeframe</FieldLabel>
                    <div className="grid grid-cols-3 gap-1 rounded-md border bg-muted p-1 sm:grid-cols-6">
                        {categoryTrendRangeOptions.map(option => (
                            <SegmentLink
                                active={trend.range === option.value}
                                href={categoryTrendHref(trend.categoryId, {
                                    ...currentQuery,
                                    range: option.value
                                })}
                                key={option.value}
                            >
                                {option.label}
                            </SegmentLink>
                        ))}
                    </div>
                </Field>
                <Field>
                    <FieldLabel htmlFor="category-trend-category">
                        Category
                    </FieldLabel>
                    <CategorySelector
                        categories={categories}
                        currentQuery={currentQuery}
                        selectedCategoryId={trend.categoryId}
                    />
                </Field>
            </div>
            {trend.range === 'custom' ? (
                <CustomDateRangeFields
                    currentQuery={currentQuery}
                    timezone={timezone}
                    trend={trend}
                />
            ) : null}
        </section>
    );
}

function TrendChart({
    data,
    trend
}: {
    readonly data: readonly ChartPoint[];
    readonly trend: CategoryTrendResponse;
}) {
    const router = useRouter();

    return (
        <Card>
            <CardHeader>
                <CardTitle>{trend.categoryName} amount trend</CardTitle>
                <CardDescription>
                    {trend.bucketCount.toLocaleString('en-US')} buckets in{' '}
                    {trend.currency}.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div
                    aria-label={`${trend.categoryName} amount trend`}
                    className="h-80"
                    role="img"
                >
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
                                width={56}
                            />
                            <ReferenceLine stroke="hsl(var(--border))" y={0} />
                            <Tooltip
                                content={
                                    <ChartTooltip currency={trend.currency} />
                                }
                            />
                            <Bar
                                cursor="pointer"
                                dataKey="Amount"
                                onClick={value => {
                                    const href = barHref(value);
                                    if (href) {
                                        router.push(href);
                                    }
                                }}
                                radius={[4, 4, 0, 0]}
                            >
                                {data.map(point => (
                                    <Cell
                                        fill={
                                            point.Amount < 0
                                                ? expenseColor
                                                : incomeColor
                                        }
                                        key={point.bucket}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

function BucketLinks({ data }: { readonly data: readonly ChartPoint[] }) {
    const buckets = data.filter(point => point.Transactions > 0).slice(0, 24);

    if (buckets.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bucket drilldown</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {buckets.map(point => (
                        <Button
                            asChild
                            className="justify-between"
                            key={point.bucket}
                            size="sm"
                            variant="outline"
                        >
                            <Link
                                aria-label={`View ${point.label} transactions`}
                                href={point.href}
                            >
                                <span className="truncate">{point.label}</span>
                                <span className="text-xs text-muted-foreground">
                                    {point.Transactions}
                                </span>
                            </Link>
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

export function CategoryTrendExplorer({
    categories,
    currentQuery,
    timezone,
    trend
}: {
    readonly categories: readonly Category[];
    readonly currentQuery: QueryState;
    readonly timezone: string;
    readonly trend: CategoryTrendResponse;
}) {
    const signedTotal = signedCategoryTotal(trend.total, trend.type);
    const data = trend.trend.map(point => ({
        label: point.label,
        Amount: signedCategoryTotal(point.total, trend.type),
        Transactions: point.transactionCount,
        href: trendTransactionHref(trend, point, timezone),
        bucket: point.bucket
    }));

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <div>
                <h1 className="text-2xl font-semibold">Category trend</h1>
                <p className="text-sm text-muted-foreground">
                    {trend.categoryName} in {trend.currency}.
                </p>
            </div>

            <TrendControls
                categories={categories}
                currentQuery={currentQuery}
                timezone={timezone}
                trend={trend}
            />

            <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <Card className="min-w-0">
                    <CardHeader className="min-w-0 p-3 sm:p-4">
                        <CardDescription className="text-xs">
                            Total
                        </CardDescription>
                        <CardTitle
                            className={`truncate text-sm sm:text-xl ${amountClassNameForCategoryTotal(
                                trend.total,
                                trend.type
                            )}`}
                        >
                            <AmountDisplay
                                currency={trend.currency}
                                value={signedTotal}
                            />
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card className="min-w-0">
                    <CardHeader className="min-w-0 p-3 sm:p-4">
                        <CardDescription className="text-xs">
                            Transactions
                        </CardDescription>
                        <CardTitle className="truncate text-sm sm:text-xl">
                            {trend.transactionCount.toLocaleString('en-US')}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {trend.densityExceeded ? (
                <Card>
                    <CardContent className="pt-4 text-sm text-muted-foreground sm:pt-6">
                        This selection has{' '}
                        {trend.bucketCount.toLocaleString('en-US')} buckets.
                        Choose a coarser bucket size to chart up to{' '}
                        {trend.maxBuckets.toLocaleString('en-US')} buckets.
                    </CardContent>
                </Card>
            ) : trend.transactionCount === 0 ? (
                <Card>
                    <CardContent className="pt-4 text-sm text-muted-foreground sm:pt-6">
                        No activity for this category in the selected timeframe.
                    </CardContent>
                </Card>
            ) : (
                <>
                    <TrendChart data={data} trend={trend} />
                    <BucketLinks data={data} />
                </>
            )}
        </div>
    );
}
