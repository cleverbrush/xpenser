'use client';

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import {
    type Currency,
    UpdateUserPreferenceBodySchema,
    type UserPreference
} from '@xpenser/contracts';
import {
    Button,
    type CheckboxRendererFieldProps,
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    Input,
    type SelectRendererFieldProps
} from '@xpenser/ui';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { updatePreferencesAction } from '@/lib/actions';
import { countryLabel, supportedCountries } from '@/lib/countries';
import { sortCurrenciesForDisplay } from '@/lib/currency-display';
import { supportedTimeZones, timeZoneLabel } from '@/lib/timezones';
import { CurrencyOption } from './currency-option';
import { isNextRedirectError, valuesToFormData } from './form-utils';
import type { CurrencyMultiSelectRendererFieldProps } from './schema-fields';

export function PreferencesForm({
    me,
    currencies
}: {
    readonly me: UserPreference;
    readonly currencies: readonly Currency[];
}) {
    const form = useSchemaForm(UpdateUserPreferenceBodySchema);
    const [selectedDefaultCurrency, setSelectedDefaultCurrency] = useState(
        me.defaultCurrency
    );
    const [selectedCountryCode, setSelectedCountryCode] = useState(
        me.countryCode
    );
    const [selectedFavoriteCurrencies, setSelectedFavoriteCurrencies] =
        useState<string[]>(
            me.favoriteCurrencies.filter(
                currency => currency !== me.defaultCurrency
            )
        );
    const [selectedTimezone, setSelectedTimezone] = useState(me.timezone);
    const [
        selectedWeeklyEmailReportEnabled,
        setSelectedWeeklyEmailReportEnabled
    ] = useState(me.weeklyEmailReportEnabled);
    const [
        selectedMonthlyEmailReportEnabled,
        setSelectedMonthlyEmailReportEnabled
    ] = useState(me.monthlyEmailReportEnabled);
    const [formVersion, setFormVersion] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const sortedCurrencies = useMemo(
        () => sortCurrenciesForDisplay(currencies),
        [currencies]
    );
    const timeZones = useMemo(() => supportedTimeZones(), []);
    const countries = useMemo(() => supportedCountries(), []);

    useEffect(() => {
        const nextFavoriteCurrencies = me.favoriteCurrencies.filter(
            currency => currency !== me.defaultCurrency
        );

        form.reset({
            defaultCurrency: me.defaultCurrency,
            countryCode: me.countryCode,
            favoriteCurrencies: nextFavoriteCurrencies,
            timezone: me.timezone,
            weeklyEmailReportEnabled: me.weeklyEmailReportEnabled,
            monthlyEmailReportEnabled: me.monthlyEmailReportEnabled
        });
        setSelectedDefaultCurrency(me.defaultCurrency);
        setSelectedCountryCode(me.countryCode);
        setSelectedFavoriteCurrencies(nextFavoriteCurrencies);
        setSelectedTimezone(me.timezone);
        setSelectedWeeklyEmailReportEnabled(me.weeklyEmailReportEnabled);
        setSelectedMonthlyEmailReportEnabled(me.monthlyEmailReportEnabled);
        setFormVersion(version => version + 1);
    }, [
        form,
        me.defaultCurrency,
        me.countryCode,
        me.favoriteCurrencies,
        me.monthlyEmailReportEnabled,
        me.timezone,
        me.weeklyEmailReportEnabled
    ]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const favoriteCurrencies = selectedFavoriteCurrencies.filter(
            currency => currency !== selectedDefaultCurrency
        );
        form.setValue({
            defaultCurrency: selectedDefaultCurrency,
            countryCode: selectedCountryCode,
            favoriteCurrencies,
            timezone: selectedTimezone,
            weeklyEmailReportEnabled: selectedWeeklyEmailReportEnabled,
            monthlyEmailReportEnabled: selectedMonthlyEmailReportEnabled
        });
        const result = await form.submit();
        if (!result.valid || !result.object) {
            return;
        }

        setPending(true);
        setError(null);
        try {
            await updatePreferencesAction(
                valuesToFormData({ ...result.object, favoriteCurrencies })
            );
        } catch (caught) {
            if (isNextRedirectError(caught)) {
                throw caught;
            }
            setError('Could not save preferences.');
        } finally {
            setPending(false);
        }
    }

    return (
        <form noValidate onSubmit={handleSubmit}>
            <FieldGroup key={formVersion}>
                <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input id="email" readOnly value={me.email} />
                </Field>
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
                            value: selectedDefaultCurrency
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
                            excludedCurrency: selectedDefaultCurrency,
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
                <Field>
                    <div className="space-y-1">
                        <FieldLabel>Email reports</FieldLabel>
                        <FieldDescription>
                            Receive spending and income analytics by email.
                        </FieldDescription>
                    </div>
                    <div className="grid gap-3 rounded-md border border-input p-3">
                        <SchemaField
                            fieldProps={
                                {
                                    checked: selectedWeeklyEmailReportEnabled,
                                    description:
                                        'Sent Monday morning for the previous week.',
                                    onCheckedChange: (checked, field) => {
                                        field.onChange(checked);
                                        setSelectedWeeklyEmailReportEnabled(
                                            checked
                                        );
                                    }
                                } satisfies CheckboxRendererFieldProps
                            }
                            forProperty={field =>
                                field.weeklyEmailReportEnabled
                            }
                            form={form}
                            label="Weekly report"
                            variant="checkbox"
                        />
                        <SchemaField
                            fieldProps={
                                {
                                    checked: selectedMonthlyEmailReportEnabled,
                                    description:
                                        'Sent on the first morning of each month.',
                                    onCheckedChange: (checked, field) => {
                                        field.onChange(checked);
                                        setSelectedMonthlyEmailReportEnabled(
                                            checked
                                        );
                                    }
                                } satisfies CheckboxRendererFieldProps
                            }
                            forProperty={field =>
                                field.monthlyEmailReportEnabled
                            }
                            form={form}
                            label="Monthly report"
                            variant="checkbox"
                        />
                    </div>
                </Field>
                {error ? <FieldError role="alert">{error}</FieldError> : null}
                <Button
                    className="w-full sm:w-auto"
                    disabled={pending}
                    type="submit"
                >
                    {pending ? 'Saving...' : 'Save preferences'}
                </Button>
            </FieldGroup>
        </form>
    );
}
