import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import { RegisterForm } from '@/components/forms/register-form';
import { getAnonymousApiClient } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
    const currencies = await getAnonymousApiClient().currencies.list();
    const topCurrencies = currencies.filter(currency =>
        ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].includes(currency.code)
    );

    return (
        <main className="flex min-h-dvh items-center justify-center bg-muted px-3 py-6 sm:px-4 sm:py-8">
            <Card className="w-full max-w-xl">
                <CardHeader>
                    <CardTitle>Create account</CardTitle>
                    <CardDescription>
                        Choose the currency setup used for reports and new
                        transactions.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <RegisterForm
                        currencies={currencies}
                        topCurrencies={topCurrencies}
                    />
                </CardContent>
            </Card>
        </main>
    );
}
