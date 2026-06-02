'use client';

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import {
    type Currency,
    UpdateUserPreferenceBodySchema,
    type UserPreference
} from '@xpenser/contracts';
import {
    Button,
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    Input
} from '@xpenser/ui';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { updatePreferencesAction } from '@/lib/actions';
import { sortCurrenciesForDisplay } from '@/lib/currency-display';
import { supportedTimeZones, timeZoneLabel } from '@/lib/timezones';
import { CurrencyMultiSelect } from './currency-multi-select';
import { CurrencyOption } from './currency-option';
import { isNextRedirectError, valuesToFormData } from './form-utils';
import { SchemaCheckboxField, SchemaSelectField } from './schema-fields';

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

    useEffect(() => {
        const nextFavoriteCurrencies = me.favoriteCurrencies.filter(
            currency => currency !== me.defaultCurrency
        );

        form.reset({
            defaultCurrency: me.defaultCurrency,
            favoriteCurrencies: nextFavoriteCurrencies,
            timezone: me.timezone,
            weeklyEmailReportEnabled: me.weeklyEmailReportEnabled,
            monthlyEmailReportEnabled: me.monthlyEmailReportEnabled
        });
        setSelectedDefaultCurrency(me.defaultCurrency);
        setSelectedFavoriteCurrencies(nextFavoriteCurrencies);
        setSelectedTimezone(me.timezone);
        setSelectedWeeklyEmailReportEnabled(me.weeklyEmailReportEnabled);
        setSelectedMonthlyEmailReportEnabled(me.monthlyEmailReportEnabled);
        setFormVersion(version => version + 1);
    }, [
        form,
        me.defaultCurrency,
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
                    value={selectedDefaultCurrency}
                />
                <SchemaField
                    forProperty={field => field.favoriteCurrencies}
                    form={form}
                    renderer={field => (
                        <CurrencyMultiSelect
                            currencies={sortedCurrencies}
                            error={field.error}
                            excludedCurrency={selectedDefaultCurrency}
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
                <Field>
                    <div className="space-y-1">
                        <FieldLabel>Email reports</FieldLabel>
                        <FieldDescription>
                            Receive spending and income analytics by email.
                        </FieldDescription>
                    </div>
                    <div className="grid gap-3 rounded-md border border-input p-3">
                        <SchemaCheckboxField
                            checked={selectedWeeklyEmailReportEnabled}
                            description="Sent Monday morning for the previous week."
                            forProperty={field =>
                                field.weeklyEmailReportEnabled
                            }
                            form={form}
                            label="Weekly report"
                            onChange={(checked, field) => {
                                field.onChange(checked);
                                setSelectedWeeklyEmailReportEnabled(checked);
                            }}
                        />
                        <SchemaCheckboxField
                            checked={selectedMonthlyEmailReportEnabled}
                            description="Sent on the first morning of each month."
                            forProperty={field =>
                                field.monthlyEmailReportEnabled
                            }
                            form={form}
                            label="Monthly report"
                            onChange={(checked, field) => {
                                field.onChange(checked);
                                setSelectedMonthlyEmailReportEnabled(checked);
                            }}
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
