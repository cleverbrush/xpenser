'use client';

import { useSchemaForm } from '@cleverbrush/react-form';
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
    Input,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@xpenser/ui';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { updatePreferencesAction } from '@/lib/actions';
import { sortCurrenciesForDisplay } from '@/lib/currency-display';
import { supportedTimeZones, timeZoneLabel } from '@/lib/timezones';
import { CurrencyMultiSelect } from './currency-multi-select';
import { CurrencyOption } from './currency-option';
import { isNextRedirectError, valuesToFormData } from './form-utils';

export function PreferencesForm({
    me,
    currencies
}: {
    readonly me: UserPreference;
    readonly currencies: readonly Currency[];
}) {
    const form = useSchemaForm(UpdateUserPreferenceBodySchema);
    const defaultCurrency = form.useField(field => field.defaultCurrency);
    const favoriteCurrencies = form.useField(field => field.favoriteCurrencies);
    const timezone = form.useField(field => field.timezone);
    const [
        selectedWeeklyEmailReportEnabled,
        setSelectedWeeklyEmailReportEnabled
    ] = useState(me.weeklyEmailReportEnabled);
    const [
        selectedMonthlyEmailReportEnabled,
        setSelectedMonthlyEmailReportEnabled
    ] = useState(me.monthlyEmailReportEnabled);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const sortedCurrencies = useMemo(
        () => sortCurrenciesForDisplay(currencies),
        [currencies]
    );
    const selectedDefaultCurrency = defaultCurrency.value ?? me.defaultCurrency;
    const selectedTimezone = timezone.value ?? me.timezone;
    const selectedFavoriteCurrencies = (
        favoriteCurrencies.value ?? me.favoriteCurrencies
    ).filter(currency => currency !== selectedDefaultCurrency);
    const defaultCurrencyInvalid =
        defaultCurrency.touched && Boolean(defaultCurrency.error);
    const timezoneInvalid = timezone.touched && Boolean(timezone.error);
    const timeZones = useMemo(() => supportedTimeZones(), []);

    useEffect(() => {
        form.reset({
            defaultCurrency: me.defaultCurrency,
            favoriteCurrencies: me.favoriteCurrencies.filter(
                currency => currency !== me.defaultCurrency
            ),
            timezone: me.timezone,
            weeklyEmailReportEnabled: me.weeklyEmailReportEnabled,
            monthlyEmailReportEnabled: me.monthlyEmailReportEnabled
        });
        setSelectedWeeklyEmailReportEnabled(me.weeklyEmailReportEnabled);
        setSelectedMonthlyEmailReportEnabled(me.monthlyEmailReportEnabled);
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
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input id="email" readOnly value={me.email} />
                </Field>
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
                            favoriteCurrencies.onChange(
                                selectedFavoriteCurrencies.filter(
                                    currency => currency !== value
                                )
                            );
                        }}
                        value={selectedDefaultCurrency}
                    >
                        <SelectTrigger aria-invalid={defaultCurrencyInvalid}>
                            <SelectValue />
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
                    error={favoriteCurrencies.error}
                    excludedCurrency={selectedDefaultCurrency}
                    onBlur={favoriteCurrencies.onBlur}
                    onChange={values => favoriteCurrencies.onChange(values)}
                    selectedCurrencies={selectedFavoriteCurrencies}
                    touched={favoriteCurrencies.touched}
                />
                <Field data-invalid={timezoneInvalid ? true : undefined}>
                    <FieldLabel>Time zone</FieldLabel>
                    <Select
                        onOpenChange={open => {
                            if (!open) {
                                timezone.onBlur();
                            }
                        }}
                        onValueChange={value => timezone.onChange(value)}
                        value={selectedTimezone}
                    >
                        <SelectTrigger aria-invalid={timezoneInvalid}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {timeZones.map(timeZone => (
                                    <SelectItem key={timeZone} value={timeZone}>
                                        {timeZoneLabel(timeZone)}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    {timezone.touched && timezone.error ? (
                        <FieldError>{timezone.error}</FieldError>
                    ) : null}
                </Field>
                <Field>
                    <div className="space-y-1">
                        <FieldLabel>Email reports</FieldLabel>
                        <FieldDescription>
                            Receive spending and income analytics by email.
                        </FieldDescription>
                    </div>
                    <div className="grid gap-3 rounded-md border border-input p-3">
                        <label
                            className="flex items-start gap-3 text-sm"
                            htmlFor="weekly-email-report"
                        >
                            <Input
                                checked={selectedWeeklyEmailReportEnabled}
                                className="mt-0.5 size-4"
                                id="weekly-email-report"
                                name="weeklyEmailReportEnabled"
                                onChange={event =>
                                    setSelectedWeeklyEmailReportEnabled(
                                        event.target.checked
                                    )
                                }
                                type="checkbox"
                                value={String(selectedWeeklyEmailReportEnabled)}
                            />
                            <span>
                                <span className="block font-medium">
                                    Weekly report
                                </span>
                                <span className="text-muted-foreground">
                                    Sent Monday morning for the previous week.
                                </span>
                            </span>
                        </label>
                        <label
                            className="flex items-start gap-3 text-sm"
                            htmlFor="monthly-email-report"
                        >
                            <Input
                                checked={selectedMonthlyEmailReportEnabled}
                                className="mt-0.5 size-4"
                                id="monthly-email-report"
                                name="monthlyEmailReportEnabled"
                                onChange={event =>
                                    setSelectedMonthlyEmailReportEnabled(
                                        event.target.checked
                                    )
                                }
                                type="checkbox"
                                value={String(
                                    selectedMonthlyEmailReportEnabled
                                )}
                            />
                            <span>
                                <span className="block font-medium">
                                    Monthly report
                                </span>
                                <span className="text-muted-foreground">
                                    Sent on the first morning of each month.
                                </span>
                            </span>
                        </label>
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
