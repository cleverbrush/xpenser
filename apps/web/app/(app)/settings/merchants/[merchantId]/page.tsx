import { Button, Card, CardContent, CardHeader, CardTitle } from '@xpenser/ui';
import { ArrowLeftIcon, ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    EditMerchantButton,
    RetryMerchantEnrichmentButton
} from '@/components/merchant-actions';
import {
    EnrichmentStatusBadge,
    enrichmentStatusLabel,
    MerchantLogo,
    merchantDisplayName
} from '@/components/merchant-display';
import { MerchantTransactionHistory } from '@/components/merchant-transaction-history';
import { getApiClient } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

type MerchantPageParams = {
    readonly merchantId: string;
};

export const dynamic = 'force-dynamic';

function parseMerchantId(value: string): number | undefined {
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

export default async function MerchantSettingsPage({
    params
}: {
    readonly params: Promise<MerchantPageParams>;
}) {
    const { merchantId } = await params;
    const selectedMerchantId = parseMerchantId(merchantId);
    if (!selectedMerchantId) {
        notFound();
    }

    const client = await getApiClient();
    const [me, merchant, transactions] = await Promise.all([
        client.auth.me(),
        client.merchants
            .get({ params: { id: selectedMerchantId } })
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
                merchantId: selectedMerchantId,
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
                    <Link href="/settings/merchants">
                        <ArrowLeftIcon aria-hidden className="size-4" />
                        Merchants
                    </Link>
                </Button>
                <div className="flex flex-col gap-4 rounded-md border bg-card p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                    <div className="flex min-w-0 items-start gap-4">
                        <MerchantLogo merchant={merchant} size="lg" />
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="truncate text-2xl font-semibold">
                                    {merchantDisplayName(merchant)}
                                </h1>
                                <EnrichmentStatusBadge
                                    status={merchant.enrichmentStatus}
                                />
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {merchant.transactionCount === 1
                                    ? '1 linked transaction'
                                    : `${merchant.transactionCount} linked transactions`}
                            </p>
                            {merchant.suggestedCategoryDisplayName ? (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Suggested category:{' '}
                                    {merchant.suggestedCategoryDisplayName}
                                </p>
                            ) : null}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <EditMerchantButton merchant={merchant} />
                        <RetryMerchantEnrichmentButton merchant={merchant} />
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
                                {merchant.name}
                            </FieldValue>
                            <FieldValue label="Brand name">
                                {merchant.brandName ?? <EmptyValue />}
                            </FieldValue>
                            <FieldValue label="Domain">
                                {merchant.domain ? (
                                    <a
                                        className="inline-flex max-w-full items-center gap-1 truncate text-primary hover:underline"
                                        href={`https://${merchant.domain}`}
                                        rel="noreferrer"
                                        target="_blank"
                                    >
                                        <span className="truncate">
                                            {merchant.domain}
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
                                {merchant.logoUrl ? (
                                    <a
                                        className="break-all text-primary hover:underline"
                                        href={merchant.logoUrl}
                                        rel="noreferrer"
                                        target="_blank"
                                    >
                                        {merchant.logoUrl}
                                    </a>
                                ) : (
                                    <EmptyValue />
                                )}
                            </FieldValue>
                            <FieldValue label="Primary color">
                                {merchant.primaryColor ? (
                                    <span className="inline-flex items-center gap-2">
                                        <span
                                            aria-hidden
                                            className="size-4 rounded-sm border"
                                            style={{
                                                backgroundColor:
                                                    merchant.primaryColor
                                            }}
                                        />
                                        {merchant.primaryColor}
                                    </span>
                                ) : (
                                    <EmptyValue />
                                )}
                            </FieldValue>
                            <FieldValue label="Updated">
                                {formatDateTime(
                                    merchant.updatedAt,
                                    me.timezone
                                )}
                            </FieldValue>
                            <div className="sm:col-span-2">
                                <FieldValue label="Description">
                                    {merchant.description ?? <EmptyValue />}
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
                                {enrichmentStatusLabel(
                                    merchant.enrichmentStatus
                                )}
                            </FieldValue>
                            <FieldValue label="Provider">
                                {merchant.enrichmentProvider ?? <EmptyValue />}
                            </FieldValue>
                            <FieldValue label="Last attempt">
                                {merchant.enrichedAt ? (
                                    formatDateTime(
                                        merchant.enrichedAt,
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

            <MerchantTransactionHistory
                merchantId={merchant.id}
                timezone={me.timezone}
                total={transactions.total}
                transactions={transactions.items}
            />
        </div>
    );
}
