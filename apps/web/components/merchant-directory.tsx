import type { Merchant } from '@xpenser/contracts';
import {
    Button,
    Card,
    CardContent,
    Input,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@xpenser/ui';
import { SearchIcon } from 'lucide-react';
import Link from 'next/link';
import {
    EnrichmentStatusBadge,
    MerchantLogo,
    merchantDisplayName
} from './merchant-display';

function merchantSubtitle(merchant: Merchant): string {
    return merchant.domain || merchant.description || 'No merchant details';
}

function transactionCountLabel(count: number): string {
    return count === 1 ? '1 transaction' : `${count} transactions`;
}

function MerchantIdentity({ merchant }: { readonly merchant: Merchant }) {
    return (
        <div className="flex min-w-0 items-center gap-3">
            <MerchantLogo merchant={merchant} />
            <div className="min-w-0">
                <Link
                    className="block truncate font-medium transition-colors hover:text-primary"
                    href={`/merchants/${merchant.id}`}
                >
                    {merchantDisplayName(merchant)}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                    {merchantSubtitle(merchant)}
                </p>
            </div>
        </div>
    );
}

function MerchantCards({
    merchants
}: {
    readonly merchants: readonly Merchant[];
}) {
    return (
        <div className="flex flex-col gap-2 sm:hidden">
            {merchants.map(merchant => (
                <article
                    className="rounded-md border bg-card p-3"
                    key={merchant.id}
                >
                    <div className="flex items-start justify-between gap-3">
                        <MerchantIdentity merchant={merchant} />
                        <EnrichmentStatusBadge
                            status={merchant.enrichmentStatus}
                        />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                            {transactionCountLabel(merchant.transactionCount)}
                        </span>
                        {merchant.suggestedCategoryDisplayName ? (
                            <span>{merchant.suggestedCategoryDisplayName}</span>
                        ) : null}
                    </div>
                    <Button
                        asChild
                        className="mt-3 w-full"
                        size="sm"
                        variant="outline"
                    >
                        <Link href={`/merchants/${merchant.id}`}>Open</Link>
                    </Button>
                </article>
            ))}
        </div>
    );
}

function MerchantTable({
    merchants
}: {
    readonly merchants: readonly Merchant[];
}) {
    return (
        <Card className="hidden sm:block">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Merchant</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Suggested category</TableHead>
                            <TableHead>Transactions</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {merchants.map(merchant => (
                            <TableRow key={merchant.id}>
                                <TableCell>
                                    <MerchantIdentity merchant={merchant} />
                                </TableCell>
                                <TableCell>
                                    <EnrichmentStatusBadge
                                        status={merchant.enrichmentStatus}
                                    />
                                </TableCell>
                                <TableCell>
                                    {merchant.suggestedCategoryDisplayName ? (
                                        merchant.suggestedCategoryDisplayName
                                    ) : (
                                        <span className="text-muted-foreground">
                                            -
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {transactionCountLabel(
                                        merchant.transactionCount
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button asChild size="sm" variant="ghost">
                                        <Link
                                            href={`/merchants/${merchant.id}`}
                                        >
                                            Open
                                        </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

export function MerchantDirectory({
    merchants,
    search
}: {
    readonly merchants: readonly Merchant[];
    readonly search: string;
}) {
    return (
        <div className="flex flex-col gap-4">
            <form className="flex flex-col gap-2 sm:flex-row">
                <Input
                    aria-label="Search merchants"
                    defaultValue={search}
                    name="search"
                    placeholder="Search by name, domain, or description"
                />
                <Button className="gap-2" type="submit" variant="outline">
                    <SearchIcon aria-hidden className="size-4" />
                    Search
                </Button>
            </form>
            {merchants.length > 0 ? (
                <>
                    <MerchantCards merchants={merchants} />
                    <MerchantTable merchants={merchants} />
                </>
            ) : (
                <Card>
                    <CardContent className="p-4 text-sm text-muted-foreground sm:p-6">
                        {search
                            ? 'No merchants match this search.'
                            : 'No merchants yet. Add a merchant while creating or editing a transaction.'}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
