import { MerchantDirectory } from '@/components/merchant-directory';
import { getApiClient } from '@/lib/api';

type MerchantSearchParams = {
    readonly search?: string | readonly string[];
};

export const dynamic = 'force-dynamic';

function readSearch(value: MerchantSearchParams['search']): string {
    const raw = Array.isArray(value) ? value[0] : value;
    return typeof raw === 'string' ? raw.trim() : '';
}

export default async function MerchantsPage({
    searchParams
}: {
    readonly searchParams: Promise<MerchantSearchParams>;
}) {
    const params = await searchParams;
    const search = readSearch(params.search);
    const client = await getApiClient();
    const merchants = await client.merchants.list({
        query: { limit: 100, search: search || undefined }
    });

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <div>
                <h1 className="text-2xl font-semibold">Merchants</h1>
                <p className="text-sm text-muted-foreground">
                    Review merchant details, enrichment status, and transaction
                    history.
                </p>
            </div>
            <MerchantDirectory merchants={merchants} search={search} />
        </div>
    );
}
