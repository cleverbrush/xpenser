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
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
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
            <div className="flex flex-wrap gap-2">
                {periods.map(item => (
                    <a
                        className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
                        href={`/dashboard?period=${item}`}
                        key={item}
                    >
                        {item}
                    </a>
                ))}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardDescription>Income</CardDescription>
                        <CardTitle>
                            {summary.incomeTotal.toFixed(2)} {summary.currency}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader>
                        <CardDescription>Expenses</CardDescription>
                        <CardTitle>
                            {summary.expenseTotal.toFixed(2)} {summary.currency}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader>
                        <CardDescription>Net</CardDescription>
                        <CardTitle>
                            {(
                                summary.incomeTotal - summary.expenseTotal
                            ).toFixed(2)}{' '}
                            {summary.currency}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
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
                                            <Badge variant="secondary">
                                                {item.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {item.total.toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                <Card>
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
                                        <TableCell>
                                            {transaction.amount.toFixed(2)}{' '}
                                            {transaction.currency}
                                        </TableCell>
                                        <TableCell>
                                            {transaction.occurredAt.toLocaleDateString()}
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
