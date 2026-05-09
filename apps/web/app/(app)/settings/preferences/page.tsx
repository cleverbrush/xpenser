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
import { updatePreferencesAction } from '@/lib/actions';
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
                    <form action={updatePreferencesAction}>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="email">Email</FieldLabel>
                                <Input id="email" readOnly value={me.email} />
                            </Field>
                            <Field>
                                <FieldLabel>Default currency</FieldLabel>
                                <Select
                                    defaultValue={me.defaultCurrency}
                                    name="defaultCurrency"
                                >
                                    <SelectTrigger>
                                        <SelectValue />
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
                                                defaultChecked={me.favoriteCurrencies.includes(
                                                    currency.code
                                                )}
                                                name="favoriteCurrencies"
                                                type="checkbox"
                                                value={currency.code}
                                            />
                                            {currency.code}
                                        </label>
                                    ))}
                                </div>
                            </FieldSet>
                            <Button type="submit">Save preferences</Button>
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
