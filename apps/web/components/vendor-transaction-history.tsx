import type { Transaction } from '@xpenser/contracts';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@xpenser/ui';
import Link from 'next/link';
import { categoryTypeLabel } from '@/lib/category-display';
import {
    amountClassNameForTransaction,
    directionBadgeClassName,
    formatDateTime,
    formatTransactionMoney
} from '@/lib/format';

function transactionAmount(transaction: Transaction) {
    return (
        <span
            className={amountClassNameForTransaction(
                transaction.amount,
                transaction.type,
                transaction.categoryKind
            )}
        >
            {formatTransactionMoney(
                transaction.amount,
                transaction.currency,
                transaction.type,
                transaction.categoryKind
            )}
        </span>
    );
}

function TransactionTypeBadge({
    transaction
}: {
    readonly transaction: Transaction;
}) {
    return (
        <Badge
            className={directionBadgeClassName(transaction.type)}
            variant="outline"
        >
            {categoryTypeLabel(transaction.type)}
        </Badge>
    );
}

export function VendorTransactionHistory({
    vendorId,
    timezone,
    total,
    transactions
}: {
    readonly vendorId: number;
    readonly timezone: string;
    readonly total: number;
    readonly transactions: readonly Transaction[];
}) {
    return (
        <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Transaction history</CardTitle>
                <Button asChild size="sm" variant="outline">
                    <Link href={`/transactions?vendorId=${vendorId}`}>
                        View all
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
                {transactions.length > 0 ? (
                    <>
                        <div className="flex flex-col gap-2 sm:hidden">
                            {transactions.map(transaction => (
                                <article
                                    className="rounded-md border p-3"
                                    key={transaction.id}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h2 className="truncate text-sm font-medium">
                                                {
                                                    transaction.categoryDisplayName
                                                }
                                            </h2>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {formatDateTime(
                                                    transaction.occurredAt,
                                                    timezone
                                                )}
                                            </p>
                                        </div>
                                        <TransactionTypeBadge
                                            transaction={transaction}
                                        />
                                    </div>
                                    <div className="mt-3">
                                        {transactionAmount(transaction)}
                                    </div>
                                </article>
                            ))}
                        </div>
                        <div className="hidden sm:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>When</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map(transaction => (
                                        <TableRow key={transaction.id}>
                                            <TableCell>
                                                {
                                                    transaction.categoryDisplayName
                                                }
                                            </TableCell>
                                            <TableCell>
                                                <TransactionTypeBadge
                                                    transaction={transaction}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {transactionAmount(transaction)}
                                            </TableCell>
                                            <TableCell>
                                                {formatDateTime(
                                                    transaction.occurredAt,
                                                    timezone
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {total > transactions.length ? (
                            <p className="mt-3 text-xs text-muted-foreground">
                                Showing {transactions.length} of {total}.
                            </p>
                        ) : null}
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        No transactions are linked to this vendor yet.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
