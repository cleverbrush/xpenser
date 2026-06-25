import { CategoryManager } from '@/components/category-manager';
import { getApiClient } from '@/lib/api';

export default async function CategoriesPage() {
    const client = await getApiClient();
    const categories = await client.categories.list({ query: {} });

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <div>
                <h1 className="text-2xl font-semibold">Categories</h1>
                <p className="text-sm text-muted-foreground">
                    Create, rename, archive, and organize categories for
                    transactions and reports.
                </p>
            </div>
            <CategoryManager categories={categories} />
        </div>
    );
}
