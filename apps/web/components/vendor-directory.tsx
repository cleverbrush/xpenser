import { FieldLimits, type Vendor } from '@xpenser/contracts';
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
import { VendorLogo, vendorDisplayName } from './vendor-display';

function vendorSubtitle(vendor: Vendor): string {
    return vendor.domain || vendor.description || 'No vendor details';
}

function transactionCountLabel(count: number): string {
    return count === 1 ? '1 transaction' : `${count} transactions`;
}

function VendorIdentity({ vendor }: { readonly vendor: Vendor }) {
    return (
        <div className="flex min-w-0 items-center gap-3">
            <VendorLogo vendor={vendor} />
            <div className="min-w-0">
                <Link
                    className="block truncate font-medium transition-colors hover:text-primary"
                    href={`/settings/vendors/${vendor.id}`}
                >
                    {vendorDisplayName(vendor)}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                    {vendorSubtitle(vendor)}
                </p>
            </div>
        </div>
    );
}

function VendorCards({ vendors }: { readonly vendors: readonly Vendor[] }) {
    return (
        <div className="flex flex-col gap-2 sm:hidden">
            {vendors.map(vendor => (
                <article
                    className="rounded-md border bg-card p-3"
                    key={vendor.id}
                >
                    <div className="flex items-start justify-between gap-3">
                        <VendorIdentity vendor={vendor} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                            {transactionCountLabel(vendor.transactionCount)}
                        </span>
                        {vendor.suggestedCategoryDisplayName ? (
                            <span>{vendor.suggestedCategoryDisplayName}</span>
                        ) : null}
                    </div>
                    <Button
                        asChild
                        className="mt-3 w-full"
                        size="sm"
                        variant="outline"
                    >
                        <Link href={`/settings/vendors/${vendor.id}`}>
                            Open
                        </Link>
                    </Button>
                </article>
            ))}
        </div>
    );
}

function VendorTable({ vendors }: { readonly vendors: readonly Vendor[] }) {
    return (
        <Card className="hidden sm:block">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Suggested category</TableHead>
                            <TableHead>Transactions</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {vendors.map(vendor => (
                            <TableRow key={vendor.id}>
                                <TableCell>
                                    <VendorIdentity vendor={vendor} />
                                </TableCell>
                                <TableCell>
                                    {vendor.suggestedCategoryDisplayName ? (
                                        vendor.suggestedCategoryDisplayName
                                    ) : (
                                        <span className="text-muted-foreground">
                                            -
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {transactionCountLabel(
                                        vendor.transactionCount
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button asChild size="sm" variant="ghost">
                                        <Link
                                            href={`/settings/vendors/${vendor.id}`}
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

export function VendorDirectory({
    vendors,
    search
}: {
    readonly vendors: readonly Vendor[];
    readonly search: string;
}) {
    return (
        <div className="flex flex-col gap-4">
            <form className="flex flex-col gap-2 sm:flex-row">
                <Input
                    aria-label="Search vendors"
                    defaultValue={search}
                    maxLength={FieldLimits.vendorSearch}
                    name="search"
                    placeholder="Search by name, domain, or description"
                />
                <Button className="gap-2" type="submit" variant="outline">
                    <SearchIcon aria-hidden className="size-4" />
                    Search
                </Button>
            </form>
            {vendors.length > 0 ? (
                <>
                    <VendorCards vendors={vendors} />
                    <VendorTable vendors={vendors} />
                </>
            ) : (
                <Card>
                    <CardContent className="p-4 text-sm text-muted-foreground sm:p-6">
                        {search
                            ? 'No vendors match this search.'
                            : 'No vendors yet. Add a vendor while creating or editing a transaction.'}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
