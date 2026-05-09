import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Field,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
    Input,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@xpenser/ui';
import Link from 'next/link';
import { registerAction } from '@/lib/actions';
import { getAnonymousApiClient } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
    const currencies = await getAnonymousApiClient().currencies.list();
    const topCurrencies = currencies.filter(currency =>
        ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].includes(currency.code)
    );

    return (
        <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
            <Card className="w-full max-w-xl">
                <CardHeader>
                    <CardTitle>Create account</CardTitle>
                    <CardDescription>
                        Choose the currency setup used for reports and new
                        transactions.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={registerAction}>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="email">Email</FieldLabel>
                                <Input
                                    autoComplete="email"
                                    id="email"
                                    name="email"
                                    required
                                    type="email"
                                />
                            </Field>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field>
                                    <FieldLabel htmlFor="password">
                                        Password
                                    </FieldLabel>
                                    <Input
                                        autoComplete="new-password"
                                        id="password"
                                        minLength={8}
                                        name="password"
                                        required
                                        type="password"
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="confirmPassword">
                                        Confirm password
                                    </FieldLabel>
                                    <Input
                                        autoComplete="new-password"
                                        id="confirmPassword"
                                        minLength={8}
                                        name="confirmPassword"
                                        required
                                        type="password"
                                    />
                                </Field>
                            </div>
                            <Field>
                                <FieldLabel>Default currency</FieldLabel>
                                <Select
                                    defaultValue="USD"
                                    name="defaultCurrency"
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Currency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            {currencies.map(currency => (
                                                <SelectItem
                                                    key={currency.code}
                                                    value={currency.code}
                                                >
                                                    {currency.code} -{' '}
                                                    {currency.name}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <FieldSet>
                                <FieldLegend>Favorite currencies</FieldLegend>
                                <div className="grid gap-2 sm:grid-cols-3">
                                    {topCurrencies.map(currency => (
                                        <label
                                            className="flex items-center gap-2 text-sm"
                                            key={currency.code}
                                        >
                                            <input
                                                defaultChecked={
                                                    currency.code === 'USD'
                                                }
                                                name="favoriteCurrencies"
                                                type="checkbox"
                                                value={currency.code}
                                            />
                                            {currency.code}
                                        </label>
                                    ))}
                                </div>
                            </FieldSet>
                            <Button type="submit">Create account</Button>
                            <p className="text-sm text-muted-foreground">
                                Already registered?{' '}
                                <Link
                                    className="font-medium text-primary"
                                    href="/login"
                                >
                                    Sign in
                                </Link>
                            </p>
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
