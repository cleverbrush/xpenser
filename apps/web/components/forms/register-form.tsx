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
    FieldLabel
} from '@xpenser/ui';
import Link from 'next/link';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { registerAction } from '@/lib/actions';
import { sortCurrenciesForDisplay } from '@/lib/currency-display';
import { supportedTimeZones, timeZoneLabel } from '@/lib/timezones';
import { CurrencyMultiSelect } from './currency-multi-select';
import { CurrencyOption } from './currency-option';
import { isNextRedirectError, valuesToFormData } from './form-utils';
import { ResendEmailConfirmationForm } from './resend-email-confirmation-form';
import { SchemaSelectField } from './schema-fields';

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
    const [selectedTimezone, setSelectedTimezone] = useState('UTC');
    const [selectedFavoriteCurrencies, setSelectedFavoriteCurrencies] =
        useState<string[]>([]);
    const sortedCurrencies = useMemo(
        () => sortCurrenciesForDisplay(currencies),
        [currencies]
    );
    const timeZones = useMemo(() => supportedTimeZones(), []);

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
            timezone: 'UTC'
        });
        setSelectedDefaultCurrency(initialDefaultCurrency);
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
                <SchemaSelectField
                    forProperty={field => field.defaultCurrency}
                    form={form}
                    label="Default currency"
                    onChange={(value, field) => {
                        const nextFavoriteCurrencies =
                            selectedFavoriteCurrencies.filter(
                                currency => currency !== value
                            );

                        field.onChange(value);
                        setSelectedDefaultCurrency(value);
                        setSelectedFavoriteCurrencies(nextFavoriteCurrencies);
                        form.setValue({
                            favoriteCurrencies: nextFavoriteCurrencies
                        });
                    }}
                    options={sortedCurrencies.map(currency => ({
                        label: <CurrencyOption currency={currency} />,
                        value: currency.code
                    }))}
                    placeholder="Currency"
                    value={selectedDefaultCurrency || initialDefaultCurrency}
                />
                <SchemaField
                    forProperty={field => field.favoriteCurrencies}
                    form={form}
                    renderer={field => (
                        <CurrencyMultiSelect
                            currencies={sortedCurrencies}
                            error={field.error}
                            excludedCurrency={
                                selectedDefaultCurrency ||
                                initialDefaultCurrency
                            }
                            onBlur={field.onBlur}
                            onChange={values => {
                                field.onChange(values);
                                setSelectedFavoriteCurrencies(values);
                            }}
                            selectedCurrencies={selectedFavoriteCurrencies}
                            touched={field.touched}
                        />
                    )}
                />
                <SchemaSelectField
                    forProperty={field => field.timezone}
                    form={form}
                    label="Time zone"
                    onChange={(value, field) => {
                        field.onChange(value);
                        setSelectedTimezone(value);
                    }}
                    options={timeZones.map(timeZone => ({
                        label: timeZoneLabel(timeZone),
                        value: timeZone
                    }))}
                    value={selectedTimezone}
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
