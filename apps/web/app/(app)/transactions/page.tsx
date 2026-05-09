import {
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Field,
    FieldLabel,
    Input,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@xpenser/ui';
import { deleteTransactionAction } from '@/lib/actions';
import { getApiClient } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage({
    searchParams
}: {
    readonly searchParams: Promise<{ readonly search?: string }>;
}) {
    const params = await searchParams;
    const client = await getApiClient();
    const transactions = await client.transactions.list({
        query: { search: params.search, page: 1, limit: 100, direction: 'desc' }
    });

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-semibold">Transactions</h1>
                <p className="text-sm text-muted-foreground">
                    Search and review all recorded income and expenses.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Find transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    <form className="flex items-end gap-3">
                        <Field className="max-w-sm">
                            <FieldLabel htmlFor="search">Search</FieldLabel>
                            <Input
                                defaultValue={params.search ?? ''}
                                id="search"
                                name="search"
                            />
                        </Field>
                        <Button type="submit" variant="outline">
                            Search
                        </Button>
                    </form>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="pt-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Original</TableHead>
                                <TableHead>Reporting</TableHead>
                                <TableHead>When</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.items.map(transaction => (
                                <TableRow key={transaction.id}>
                                    <TableCell>
                                        {transaction.categoryName}
                                    </TableCell>
                                    <TableCell>{transaction.type}</TableCell>
                                    <TableCell>
                                        {transaction.amount.toFixed(2)}{' '}
                                        {transaction.currency}
                                    </TableCell>
                                    <TableCell>
                                        {transaction.defaultCurrencyAmount.toFixed(
                                            2
                                        )}{' '}
                                        {transaction.defaultCurrency}
                                    </TableCell>
                                    <TableCell>
                                        {transaction.occurredAt.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <form action={deleteTransactionAction}>
                                            <input
                                                name="id"
                                                type="hidden"
                                                value={transaction.id}
                                            />
                                            <Button
                                                size="sm"
                                                type="submit"
                                                variant="ghost"
                                            >
                                                Delete
                                            </Button>
                                        </form>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
