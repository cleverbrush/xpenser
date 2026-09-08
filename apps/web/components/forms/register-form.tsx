'use client';

import { useSchemaForm } from '@cleverbrush/react-form';
import {
    type Currency,
    FieldLimits,
    RegisterBodySchema
} from '@xpenser/contracts';
import {
    Button,
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel
} from '@xpenser/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { SchemaField } from '@/components/forms/schema-fields';
import { registerAction } from '@/lib/actions';
import { countryLabel, supportedCountries } from '@/lib/countries';
import { sortCurrenciesForDisplay } from '@/lib/currency-display';
import { supportedTimeZones, timeZoneLabel } from '@/lib/timezones';
import { CurrencyOption } from './currency-option';
import { isNextRedirectError, valuesToFormData } from './form-utils';
import { ResendEmailConfirmationForm } from './resend-email-confirmation-form';

export function RegisterForm({
    currencies
}: {
    readonly currencies: readonly Currency[];
}) {
    const form = useSchemaForm(RegisterBodySchema);
    const [confirmationEmail, setConfirmationEmail] = useState<string | null>(
        null
    );
    const { submitting: pending, error } = form;
    const defaultCurrency = form.useField(field => field.defaultCurrency);
    const favoriteCurrencies = form.useField(field => field.favoriteCurrencies);
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
    }, [form, initialDefaultCurrency]);

    const handleSubmit = form.handleSubmit(
        async values => {
            const response = await registerAction(
                valuesToFormData({
                    ...values,
                    favoriteCurrencies: values.favoriteCurrencies?.filter(
                        currency => currency !== values.defaultCurrency
                    )
                })
            );
            if (response && 'error' in response && response.error)
                return { ok: false, error: response.error };
            return {
                ok: true,
                data:
                    response &&
                    'verificationRequired' in response &&
                    response.verificationRequired
                        ? response.email
                        : undefined
            };
        },
        {
            onSuccess: email => {
                if (email) setConfirmationEmail(email);
            },
            onError: caught => {
                if (isNextRedirectError(caught)) throw caught;
                return 'Could not create the account. Try a different email.';
            }
        }
    );

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
            <FieldGroup>
                <SchemaField
                    fieldProps={{
                        autoComplete: 'email',
                        maxLength: FieldLimits.email
                    }}
                    forProperty={field => field.email}
                    form={form}
                    label="Email"
                    name="email"
                    variant="email"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                    <SchemaField
                        fieldProps={{
                            autoComplete: 'new-password',
                            maxLength: FieldLimits.password
                        }}
                        forProperty={field => field.password}
                        form={form}
                        label="Password"
                        name="password"
                        variant="password"
                    />
                    <SchemaField
                        fieldProps={{
                            autoComplete: 'new-password',
                            maxLength: FieldLimits.password
                        }}
                        forProperty={field => field.confirmPassword}
                        form={form}
                        label="Confirm password"
                        name="confirmPassword"
                        variant="password"
                    />
                </div>
                <SchemaField
                    fieldProps={{
                        onValueChange: (value, field) => {
                            field.onChange(value);
                            favoriteCurrencies.setValue(
                                (favoriteCurrencies.value ?? []).filter(
                                    currency => currency !== value
                                )
                            );
                        },
                        options: sortedCurrencies.map(currency => ({
                            label: <CurrencyOption currency={currency} />,
                            value: currency.code
                        })),
                        placeholder: 'Currency'
                    }}
                    forProperty={field => field.defaultCurrency}
                    form={form}
                    label="Default currency"
                    variant="select"
                />
                <SchemaField
                    fieldProps={{
                        options: countries.map(country => ({
                            label: countryLabel(country.code),
                            value: country.code
                        }))
                    }}
                    forProperty={field => field.countryCode}
                    form={form}
                    label="Country"
                    variant="select"
                />
                <SchemaField
                    fieldProps={{
                        currencies: sortedCurrencies,
                        excludedCurrency: defaultCurrency.value
                    }}
                    forProperty={field => field.favoriteCurrencies}
                    form={form}
                    variant="currency-multi-select"
                />
                <SchemaField
                    fieldProps={{
                        options: timeZones.map(timeZone => ({
                            label: timeZoneLabel(timeZone),
                            value: timeZone
                        }))
                    }}
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
