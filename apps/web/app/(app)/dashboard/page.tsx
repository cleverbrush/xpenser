import {
    Badge,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@xpenser/ui';
import { redirect } from 'next/navigation';
import { AddTransactionDialog } from '@/components/add-transaction-dialog';
import { getApiClient } from '@/lib/api';
import {
    amountClassNameForType,
    amountClassNameForValue,
    directionBadgeClassName,
    formatDateTime,
    formatDirectionalMoney,
    formatMoney
} from '@/lib/format';

const periods = ['week', 'month', 'quarter', 'year'] as const;

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
    searchParams
}: {
    readonly searchParams: Promise<{ readonly period?: string }>;
}) {
    const params = await searchParams;
    const period = periods.includes(params.period as (typeof periods)[number])
        ? (params.period as (typeof periods)[number])
        : 'month';
    const client = await getApiClient();
    const [me, categories, currencies, summary] = await Promise.all([
        client.auth.me(),
        client.categories.list(),
        client.currencies.list(),
        client.dashboard.summary({ query: { period } })
    ]);

    if (!me.hasCategories) {
        redirect('/setup/categories');
    }

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Dashboard</h1>
                    <p className="text-sm text-muted-foreground">
                        Totals shown in {summary.currency}.
                    </p>
                </div>
                <AddTransactionDialog
                    categories={categories}
                    currencies={currencies}
                    defaultCurrency={me.defaultCurrency}
                />
            </div>
            <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
                {periods.map(item => (
                    <a
                        className="rounded-md border px-2 py-2 text-center text-sm capitalize hover:bg-muted sm:px-3 sm:py-1"
                        href={`/dashboard?period=${item}`}
                        key={item}
                    >
                        {item}
                    </a>
                ))}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardDescription>Income</CardDescription>
                        <CardTitle
                            className={`text-xl sm:text-lg ${amountClassNameForType('income')}`}
                        >
                            {formatDirectionalMoney(
                                summary.incomeTotal,
                                summary.currency,
                                'income'
                            )}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardDescription>Expenses</CardDescription>
                        <CardTitle
                            className={`text-xl sm:text-lg ${amountClassNameForType('expense')}`}
                        >
                            {formatDirectionalMoney(
                                summary.expenseTotal,
                                summary.currency,
                                'expense'
                            )}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardDescription>Net</CardDescription>
                        <CardTitle
                            className={`text-xl sm:text-lg ${amountClassNameForValue(
                                summary.incomeTotal - summary.expenseTotal
                            )}`}
                        >
                            {formatMoney(
                                summary.incomeTotal - summary.expenseTotal,
                                summary.currency
                            )}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                <section className="sm:hidden">
                    <h2 className="mb-3 text-base font-semibold">
                        By category
                    </h2>
                    <div className="divide-y rounded-lg border bg-card">
                        {summary.byCategory.length === 0 ? (
                            <div className="p-4 text-sm text-muted-foreground">
                                No category totals yet.
                            </div>
                        ) : (
                            summary.byCategory.map(item => (
                                <div
                                    className="flex items-center justify-between gap-3 p-4"
                                    key={`${item.type}-${item.categoryId}`}
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">
                                            {item.categoryName}
                                        </p>
                                        <Badge
                                            className={`mt-1 ${directionBadgeClassName(item.type)}`}
                                            variant="outline"
                                        >
                                            {item.type}
                                        </Badge>
                                    </div>
                                    <p
                                        className={`shrink-0 text-sm font-semibold ${amountClassNameForType(item.type)}`}
                                    >
                                        {formatDirectionalMoney(
                                            item.total,
                                            summary.currency,
                                            item.type
                                        )}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </section>
                <Card className="hidden sm:block">
                    <CardHeader>
                        <CardTitle>By category</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-right">
                                        Total
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summary.byCategory.map(item => (
                                    <TableRow
                                        key={`${item.type}-${item.categoryId}`}
                                    >
                                        <TableCell>
                                            {item.categoryName}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                className={directionBadgeClassName(
                                                    item.type
                                                )}
                                                variant="outline"
                                            >
                                                {item.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell
                                            className={`text-right font-medium ${amountClassNameForType(item.type)}`}
                                        >
                                            {formatDirectionalMoney(
                                                item.total,
                                                summary.currency,
                                                item.type
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                <section className="sm:hidden">
                    <h2 className="mb-3 text-base font-semibold">
                        Latest transactions
                    </h2>
                    <div className="divide-y rounded-lg border bg-card">
                        {summary.latestTransactions.length === 0 ? (
                            <div className="p-4 text-sm text-muted-foreground">
                                No transactions yet.
                            </div>
                        ) : (
                            summary.latestTransactions.map(transaction => (
                                <div
                                    className="flex items-center justify-between gap-3 p-4"
                                    key={transaction.id}
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">
                                            {transaction.categoryName}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {formatDateTime(
                                                transaction.occurredAt
                                            )}
                                        </p>
                                    </div>
                                    <p
                                        className={`shrink-0 text-sm font-semibold ${amountClassNameForType(transaction.type)}`}
                                    >
                                        {formatDirectionalMoney(
                                            transaction.amount,
                                            transaction.currency,
                                            transaction.type
                                        )}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </section>
                <Card className="hidden sm:block">
                    <CardHeader>
                        <CardTitle>Latest transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>When</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summary.latestTransactions.map(transaction => (
                                    <TableRow key={transaction.id}>
                                        <TableCell>
                                            {transaction.categoryName}
                                        </TableCell>
                                        <TableCell
                                            className={amountClassNameForType(
                                                transaction.type
                                            )}
                                        >
                                            {formatDirectionalMoney(
                                                transaction.amount,
                                                transaction.currency,
                                                transaction.type
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {formatDateTime(
                                                transaction.occurredAt
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
