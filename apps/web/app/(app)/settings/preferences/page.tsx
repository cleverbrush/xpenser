import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import { CategorySettings } from '@/components/category-settings';
import { PreferencesForm } from '@/components/forms/preferences-form';
import { getApiClient } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function PreferencesPage() {
    const client = await getApiClient();
    const [me, currencies, categories] = await Promise.all([
        client.auth.me(),
        client.currencies.list(),
        client.categories.list()
    ]);

    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-5 sm:gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>User preferences</CardTitle>
                    <CardDescription>
                        Default currency changes affect future conversions.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <PreferencesForm currencies={currencies} me={me} />
                </CardContent>
            </Card>
            <CategorySettings categories={categories} />
        </div>
    );
}
