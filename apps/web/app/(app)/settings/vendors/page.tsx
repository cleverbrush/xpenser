import { VendorDirectory } from '@/components/vendor-directory';
import { getApiClient, getCurrentUser } from '@/lib/api';
import { selectedBudgetQuery } from '@/lib/budgets';

type VendorSearchParams = {
    readonly search?: string | readonly string[];
};

function readSearch(value: VendorSearchParams['search']): string {
    const raw = Array.isArray(value) ? value[0] : value;
    return typeof raw === 'string' ? raw.trim() : '';
}

export default async function VendorsSettingsPage({
    searchParams
}: {
    readonly searchParams: Promise<VendorSearchParams>;
}) {
    const params = await searchParams;
    const search = readSearch(params.search);
    const client = await getApiClient();
    const me = await getCurrentUser();
    const budgetQuery = await selectedBudgetQuery(me);
    const vendors = await client.vendors.list({
        query: { ...budgetQuery, limit: 100, search: search || undefined }
    });

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <div>
                <h1 className="text-2xl font-semibold">Vendors</h1>
                <p className="text-sm text-muted-foreground">
                    Review vendor profile details and transaction history.
                </p>
            </div>
            <VendorDirectory vendors={vendors} search={search} />
        </div>
    );
}
