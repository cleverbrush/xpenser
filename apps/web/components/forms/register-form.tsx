'use client';

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import type { Currency } from '@xpenser/contracts';
import { RegisterBodySchema } from '@xpenser/contracts';
import {
    Button,
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@xpenser/ui';
import Link from 'next/link';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { registerAction } from '@/lib/actions';
import { sortCurrenciesForDisplay } from '@/lib/currency-display';
import { CurrencyMultiSelect } from './currency-multi-select';
import { CurrencyOption } from './currency-option';
import { isNextRedirectError, valuesToFormData } from './form-utils';

export function RegisterForm({
    currencies
}: {
    readonly currencies: readonly Currency[];
}) {
    const form = useSchemaForm(RegisterBodySchema);
    const defaultCurrency = form.useField(field => field.defaultCurrency);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [selectedFavoriteCurrencies, setSelectedFavoriteCurrencies] =
        useState<string[]>([]);
    const sortedCurrencies = useMemo(
        () => sortCurrenciesForDisplay(currencies),
        [currencies]
    );

    const initialDefaultCurrency = useMemo(
        () =>
            currencies.some(currency => currency.code === 'USD')
                ? 'USD'
                : sortedCurrencies[0]?.code,
        [currencies, sortedCurrencies]
    );

    useEffect(() => {
        if (!initialDefaultCurrency) {
            return;
        }

        form.reset({
            defaultCurrency: initialDefaultCurrency,
            favoriteCurrencies: []
        });
        setSelectedFavoriteCurrencies([]);
    }, [form, initialDefaultCurrency]);

    const defaultCurrencyInvalid =
        defaultCurrency.touched && Boolean(defaultCurrency.error);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const selectedDefault =
            defaultCurrency.value ?? initialDefaultCurrency ?? '';
        const favoriteCurrencies = selectedFavoriteCurrencies.filter(
            currency => currency !== selectedDefault
        );
        form.setValue({ favoriteCurrencies });
        const result = await form.submit();
        if (!result.valid || !result.object) {
            return;
        }

        setPending(true);
        setError(null);
        try {
            const response = await registerAction(
                valuesToFormData({ ...result.object, favoriteCurrencies })
            );
            if (response?.error) {
                setError(response.error);
            }
        } catch (caught) {
            if (isNextRedirectError(caught)) {
                throw caught;
            }
            setError('Could not create the account. Try a different email.');
        } finally {
            setPending(false);
        }
    }

    return (
        <form noValidate onSubmit={handleSubmit}>
            <FieldGroup>
                <SchemaField
                    fieldProps={{ autoComplete: 'email' }}
                    forProperty={field => field.email}
                    form={form}
                    label="Email"
                    name="email"
                    variant="email"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                    <SchemaField
                        fieldProps={{ autoComplete: 'new-password' }}
                        forProperty={field => field.password}
                        form={form}
                        label="Password"
                        name="password"
                        variant="password"
                    />
                    <SchemaField
                        fieldProps={{ autoComplete: 'new-password' }}
                        forProperty={field => field.confirmPassword}
                        form={form}
                        label="Confirm password"
                        name="confirmPassword"
                        variant="password"
                    />
                </div>
                <Field data-invalid={defaultCurrencyInvalid ? true : undefined}>
                    <FieldLabel>Default currency</FieldLabel>
                    <Select
                        onOpenChange={open => {
                            if (!open) {
                                defaultCurrency.onBlur();
                            }
                        }}
                        onValueChange={value => {
                            defaultCurrency.onChange(value);
                            setSelectedFavoriteCurrencies(current =>
                                current.filter(currency => currency !== value)
                            );
                        }}
                        value={defaultCurrency.value ?? initialDefaultCurrency}
                    >
                        <SelectTrigger aria-invalid={defaultCurrencyInvalid}>
                            <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {sortedCurrencies.map(currency => (
                                    <SelectItem
                                        key={currency.code}
                                        value={currency.code}
                                    >
                                        <CurrencyOption currency={currency} />
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    {defaultCurrency.touched && defaultCurrency.error ? (
                        <FieldError>{defaultCurrency.error}</FieldError>
                    ) : null}
                </Field>
                <CurrencyMultiSelect
                    currencies={sortedCurrencies}
                    excludedCurrency={
                        defaultCurrency.value ?? initialDefaultCurrency
                    }
                    onChange={setSelectedFavoriteCurrencies}
                    selectedCurrencies={selectedFavoriteCurrencies}
                />
                {error ? <FieldError role="alert">{error}</FieldError> : null}
                <Button className="w-full" disabled={pending} type="submit">
                    {pending ? 'Creating account...' : 'Create account'}
                </Button>
                <p className="text-sm text-muted-foreground">
                    Already registered?{' '}
                    <Link className="font-medium text-primary" href="/login">
                        Sign in
                    </Link>
                </p>
            </FieldGroup>
        </form>
    );
}
