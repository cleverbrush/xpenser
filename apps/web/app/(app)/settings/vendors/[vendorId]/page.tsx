import { Button, Card, CardContent, CardHeader, CardTitle } from '@xpenser/ui';
import { ArrowLeftIcon, ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    EditVendorButton,
    RetryVendorEnrichmentButton
} from '@/components/vendor-actions';
import {
    EnrichmentStatusBadge,
    enrichmentStatusLabel,
    VendorLogo,
    vendorDisplayName
} from '@/components/vendor-display';
import { VendorTransactionHistory } from '@/components/vendor-transaction-history';
import { getApiClient } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

type VendorPageParams = {
    readonly vendorId: string;
};

export const dynamic = 'force-dynamic';

function parseVendorId(value: string): number | undefined {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : undefined;
}

function isNotFoundApiError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        error.status === 404
    );
}

function FieldValue({
    children,
    label
}: {
    readonly children: React.ReactNode;
    readonly label: string;
}) {
    return (
        <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                {label}
            </dt>
            <dd className="mt-1 min-h-5 break-words text-sm">{children}</dd>
        </div>
    );
}

function EmptyValue() {
    return <span className="text-muted-foreground">-</span>;
}

export default async function VendorSettingsPage({
    params
}: {
    readonly params: Promise<VendorPageParams>;
}) {
    const { vendorId } = await params;
    const selectedVendorId = parseVendorId(vendorId);
    if (!selectedVendorId) {
        notFound();
    }

    const client = await getApiClient();
    const [me, vendor, transactions] = await Promise.all([
        client.auth.me(),
        client.vendors
            .get({ params: { id: selectedVendorId } })
            .catch(error => {
                if (isNotFoundApiError(error)) {
                    notFound();
                }
                throw error;
            }),
        client.transactions.list({
            query: {
                direction: 'desc',
                limit: 25,
                vendorId: selectedVendorId,
                page: 1
            }
        })
    ]);

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <div className="flex flex-col gap-3">
                <Button
                    asChild
                    className="w-fit gap-2"
                    size="sm"
                    variant="ghost"
                >
                    <Link href="/settings/vendors">
                        <ArrowLeftIcon aria-hidden className="size-4" />
                        Vendors
                    </Link>
                </Button>
                <div className="flex flex-col gap-4 rounded-md border bg-card p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                    <div className="flex min-w-0 items-start gap-4">
                        <VendorLogo vendor={vendor} size="lg" />
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="truncate text-2xl font-semibold">
                                    {vendorDisplayName(vendor)}
                                </h1>
                                <EnrichmentStatusBadge
                                    status={vendor.enrichmentStatus}
                                />
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {vendor.transactionCount === 1
                                    ? '1 linked transaction'
                                    : `${vendor.transactionCount} linked transactions`}
                            </p>
                            {vendor.suggestedCategoryDisplayName ? (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Suggested category:{' '}
                                    {vendor.suggestedCategoryDisplayName}
                                </p>
                            ) : null}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <EditVendorButton vendor={vendor} />
                        <RetryVendorEnrichmentButton vendor={vendor} />
                    </div>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
                <Card>
                    <CardHeader>
                        <CardTitle>Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <FieldValue label="Entered name">
                                {vendor.name}
                            </FieldValue>
                            <FieldValue label="Resolved name">
                                {vendor.resolvedName ?? <EmptyValue />}
                            </FieldValue>
                            <FieldValue label="Domain">
                                {vendor.domain ? (
                                    <a
                                        className="inline-flex max-w-full items-center gap-1 truncate text-primary hover:underline"
                                        href={`https://${vendor.domain}`}
                                        rel="noreferrer"
                                        target="_blank"
                                    >
                                        <span className="truncate">
                                            {vendor.domain}
                                        </span>
                                        <ExternalLinkIcon
                                            aria-hidden
                                            className="size-3.5 shrink-0"
                                        />
                                    </a>
                                ) : (
                                    <EmptyValue />
                                )}
                            </FieldValue>
                            <FieldValue label="Logo">
                                {vendor.logoUrl ? (
                                    <a
                                        className="break-all text-primary hover:underline"
                                        href={vendor.logoUrl}
                                        rel="noreferrer"
                                        target="_blank"
                                    >
                                        {vendor.logoUrl}
                                    </a>
                                ) : (
                                    <EmptyValue />
                                )}
                            </FieldValue>
                            <FieldValue label="Primary color">
                                {vendor.primaryColor ? (
                                    <span className="inline-flex items-center gap-2">
                                        <span
                                            aria-hidden
                                            className="size-4 rounded-sm border"
                                            style={{
                                                backgroundColor:
                                                    vendor.primaryColor
                                            }}
                                        />
                                        {vendor.primaryColor}
                                    </span>
                                ) : (
                                    <EmptyValue />
                                )}
                            </FieldValue>
                            <FieldValue label="Updated">
                                {formatDateTime(vendor.updatedAt, me.timezone)}
                            </FieldValue>
                            <div className="sm:col-span-2">
                                <FieldValue label="Description">
                                    {vendor.description ?? <EmptyValue />}
                                </FieldValue>
                            </div>
                        </dl>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Enrichment</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-4">
                            <FieldValue label="Status">
                                {enrichmentStatusLabel(vendor.enrichmentStatus)}
                            </FieldValue>
                            <FieldValue label="Provider">
                                {vendor.enrichmentProvider ?? <EmptyValue />}
                            </FieldValue>
                            <FieldValue label="Last attempt">
                                {vendor.enrichedAt ? (
                                    formatDateTime(
                                        vendor.enrichedAt,
                                        me.timezone
                                    )
                                ) : (
                                    <EmptyValue />
                                )}
                            </FieldValue>
                        </dl>
                    </CardContent>
                </Card>
            </div>

            <VendorTransactionHistory
                vendorId={vendor.id}
                timezone={me.timezone}
                total={transactions.total}
                transactions={transactions.items}
            />
        </div>
    );
}
