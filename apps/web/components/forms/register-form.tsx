'use client';

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import type { Currency } from '@xpenser/contracts';
import { RegisterBodySchema } from '@xpenser/contracts';
import {
    Button,
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    type SelectRendererFieldProps
} from '@xpenser/ui';
import Link from 'next/link';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { registerAction } from '@/lib/actions';
import { countryLabel, supportedCountries } from '@/lib/countries';
import { sortCurrenciesForDisplay } from '@/lib/currency-display';
import { supportedTimeZones, timeZoneLabel } from '@/lib/timezones';
import { CurrencyOption } from './currency-option';
import { isNextRedirectError, valuesToFormData } from './form-utils';
import { ResendEmailConfirmationForm } from './resend-email-confirmation-form';
import type { CurrencyMultiSelectRendererFieldProps } from './schema-fields';

export function RegisterForm({
    currencies
}: {
    readonly currencies: readonly Currency[];
}) {
    const form = useSchemaForm(RegisterBodySchema);
    const [confirmationEmail, setConfirmationEmail] = useState<string | null>(
        null
    );
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [formVersion, setFormVersion] = useState(0);
    const [selectedDefaultCurrency, setSelectedDefaultCurrency] = useState('');
    const [selectedCountryCode, setSelectedCountryCode] = useState('US');
    const [selectedTimezone, setSelectedTimezone] = useState('UTC');
    const [selectedFavoriteCurrencies, setSelectedFavoriteCurrencies] =
        useState<string[]>([]);
    const sortedCurrencies = useMemo(
        () => sortCurrenciesForDisplay(currencies),
        [currencies]
    );
    const timeZones = useMemo(() => supportedTimeZones(), []);
    const countries = useMemo(() => supportedCountries(), []);

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
            favoriteCurrencies: [],
            countryCode: 'US',
            timezone: 'UTC'
        });
        setSelectedDefaultCurrency(initialDefaultCurrency);
        setSelectedCountryCode('US');
        setSelectedTimezone('UTC');
        setSelectedFavoriteCurrencies([]);
        setFormVersion(version => version + 1);
    }, [form, initialDefaultCurrency]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const selectedDefault =
            selectedDefaultCurrency || initialDefaultCurrency || '';
        const favoriteCurrencies = selectedFavoriteCurrencies.filter(
            currency => currency !== selectedDefault
        );
        form.setValue({
            defaultCurrency: selectedDefault,
            favoriteCurrencies,
            countryCode: selectedCountryCode,
            timezone: selectedTimezone
        });
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
            if (response && 'error' in response && response.error) {
                setError(response.error);
            } else if (
                response &&
                'verificationRequired' in response &&
                response.verificationRequired
            ) {
                setConfirmationEmail(response.email);
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

    if (confirmationEmail) {
        return (
            <FieldGroup>
                <Field>
                    <FieldLabel>Email confirmation sent</FieldLabel>
                    <FieldDescription>
                        Open the magic link sent to {confirmationEmail} to
                        confirm your email and finish signing in.
                    </FieldDescription>
                </Field>
                <ResendEmailConfirmationForm initialEmail={confirmationEmail} />
                <p className="text-sm text-muted-foreground">
                    Already confirmed?{' '}
                    <Link className="font-medium text-primary" href="/login">
                        Sign in
                    </Link>
                </p>
            </FieldGroup>
        );
    }

    return (
        <form noValidate onSubmit={handleSubmit}>
            <FieldGroup key={formVersion}>
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
                <SchemaField
                    fieldProps={
                        {
                            onValueChange: (value, field) => {
                                const nextFavoriteCurrencies =
                                    selectedFavoriteCurrencies.filter(
                                        currency => currency !== value
                                    );

                                field.onChange(value);
                                setSelectedDefaultCurrency(value);
                                setSelectedFavoriteCurrencies(
                                    nextFavoriteCurrencies
                                );
                                form.setValue({
                                    favoriteCurrencies: nextFavoriteCurrencies
                                });
                            },
                            options: sortedCurrencies.map(currency => ({
                                label: <CurrencyOption currency={currency} />,
                                value: currency.code
                            })),
                            placeholder: 'Currency',
                            value:
                                selectedDefaultCurrency ||
                                initialDefaultCurrency
                        } satisfies SelectRendererFieldProps
                    }
                    forProperty={field => field.defaultCurrency}
                    form={form}
                    label="Default currency"
                    variant="select"
                />
                <SchemaField
                    fieldProps={
                        {
                            onValueChange: (value, field) => {
                                field.onChange(value);
                                setSelectedCountryCode(value);
                            },
                            options: countries.map(country => ({
                                label: countryLabel(country.code),
                                value: country.code
                            })),
                            value: selectedCountryCode
                        } satisfies SelectRendererFieldProps
                    }
                    forProperty={field => field.countryCode}
                    form={form}
                    label="Country"
                    variant="select"
                />
                <SchemaField
                    fieldProps={
                        {
                            currencies: sortedCurrencies,
                            excludedCurrency:
                                selectedDefaultCurrency ||
                                initialDefaultCurrency,
                            onChange: (values, field) => {
                                field.onChange(values);
                                setSelectedFavoriteCurrencies(values);
                            },
                            selectedCurrencies: selectedFavoriteCurrencies
                        } satisfies CurrencyMultiSelectRendererFieldProps
                    }
                    forProperty={field => field.favoriteCurrencies}
                    form={form}
                    variant="currency-multi-select"
                />
                <SchemaField
                    fieldProps={
                        {
                            onValueChange: (value, field) => {
                                field.onChange(value);
                                setSelectedTimezone(value);
                            },
                            options: timeZones.map(timeZone => ({
                                label: timeZoneLabel(timeZone),
                                value: timeZone
                            })),
                            value: selectedTimezone
                        } satisfies SelectRendererFieldProps
                    }
                    forProperty={field => field.timezone}
                    form={form}
                    label="Time zone"
                    variant="select"
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
