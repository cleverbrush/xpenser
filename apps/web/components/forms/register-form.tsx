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
    FieldLegend,
    FieldSet,
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
import { isNextRedirectError, valuesToFormData } from './form-utils';

export function RegisterForm({
    currencies,
    topCurrencies
}: {
    readonly currencies: readonly Currency[];
    readonly topCurrencies: readonly Currency[];
}) {
    const form = useSchemaForm(RegisterBodySchema);
    const defaultCurrency = form.useField(field => field.defaultCurrency);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [selectedFavoriteCurrencies, setSelectedFavoriteCurrencies] =
        useState<string[]>([]);

    const initialDefaultCurrency = useMemo(
        () =>
            currencies.some(currency => currency.code === 'USD')
                ? 'USD'
                : currencies[0]?.code,
        [currencies]
    );

    useEffect(() => {
        if (!initialDefaultCurrency) {
            return;
        }

        form.reset({
            defaultCurrency: initialDefaultCurrency,
            favoriteCurrencies: [initialDefaultCurrency]
        });
        setSelectedFavoriteCurrencies([initialDefaultCurrency]);
    }, [form, initialDefaultCurrency]);

    const defaultCurrencyInvalid =
        defaultCurrency.touched && Boolean(defaultCurrency.error);

    function toggleFavoriteCurrency(code: string, checked: boolean) {
        setSelectedFavoriteCurrencies(current =>
            checked
                ? Array.from(new Set([...current, code]))
                : current.filter(value => value !== code)
        );
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        form.setValue({ favoriteCurrencies: selectedFavoriteCurrencies });
        const result = await form.submit();
        if (!result.valid || !result.object) {
            return;
        }

        setPending(true);
        setError(null);
        try {
            await registerAction(valuesToFormData(result.object));
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
                        onValueChange={defaultCurrency.onChange}
                        value={defaultCurrency.value ?? initialDefaultCurrency}
                    >
                        <SelectTrigger aria-invalid={defaultCurrencyInvalid}>
                            <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {currencies.map(currency => (
                                    <SelectItem
                                        key={currency.code}
                                        value={currency.code}
                                    >
                                        {currency.code} - {currency.name}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    {defaultCurrency.touched && defaultCurrency.error ? (
                        <FieldError>{defaultCurrency.error}</FieldError>
                    ) : null}
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
                                    checked={selectedFavoriteCurrencies.includes(
                                        currency.code
                                    )}
                                    name="favoriteCurrencies"
                                    onChange={event =>
                                        toggleFavoriteCurrency(
                                            currency.code,
                                            event.target.checked
                                        )
                                    }
                                    type="checkbox"
                                    value={currency.code}
                                />
                                {currency.code}
                            </label>
                        ))}
                    </div>
                </FieldSet>
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
