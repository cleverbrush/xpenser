import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import { PreferencesForm } from '@/components/forms/preferences-form';
import { getApiClient } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function PreferencesPage() {
    const client = await getApiClient();
    const [me, currencies] = await Promise.all([
        client.auth.me(),
        client.currencies.list()
    ]);
    const topCurrencies = currencies.filter(currency =>
        ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].includes(currency.code)
    );

    return (
        <div className="mx-auto max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle>User preferences</CardTitle>
                    <CardDescription>
                        Default currency changes affect future conversions.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <PreferencesForm
                        currencies={currencies}
                        me={me}
                        topCurrencies={topCurrencies}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
