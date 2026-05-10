import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import { redirect } from 'next/navigation';
import { CategoryForm } from '@/components/forms/category-form';
import { getApiClient } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function CategorySetupPage() {
    const client = await getApiClient();
    const me = await client.auth.me();
    if (me.hasCategories) {
        redirect('/dashboard');
    }

    return (
        <div className="mx-auto max-w-lg">
            <Card>
                <CardHeader>
                    <CardTitle>Create your first category</CardTitle>
                    <CardDescription>
                        Transactions need a category, so this is required before
                        the dashboard opens.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CategoryForm
                        first
                        namePlaceholder="Groceries"
                        submitLabel="Create category"
                    />
                </CardContent>
            </Card>
        </div>
    );
}
