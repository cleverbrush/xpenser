'use client';

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import {
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
import { supportedTimeZones, timeZoneLabel } from '@/lib/timezones';
import { isNextRedirectError, valuesToFormData } from './form-utils';

export function PreferencesForm({ me }: { readonly me: UserPreference }) {
    const form = useSchemaForm(UpdateUserPreferenceBodySchema);
    const [selectedCountryCode, setSelectedCountryCode] = useState(
        me.countryCode
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
    const timeZones = useMemo(() => supportedTimeZones(), []);
    const countries = useMemo(() => supportedCountries(), []);

    useEffect(() => {
        form.reset({
            countryCode: me.countryCode,
            timezone: me.timezone,
            weeklyEmailReportEnabled: me.weeklyEmailReportEnabled,
            monthlyEmailReportEnabled: me.monthlyEmailReportEnabled
        });
        setSelectedCountryCode(me.countryCode);
        setSelectedTimezone(me.timezone);
        setSelectedWeeklyEmailReportEnabled(me.weeklyEmailReportEnabled);
        setSelectedMonthlyEmailReportEnabled(me.monthlyEmailReportEnabled);
        setFormVersion(version => version + 1);
    }, [
        form,
        me.countryCode,
        me.monthlyEmailReportEnabled,
        me.timezone,
        me.weeklyEmailReportEnabled
    ]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        form.setValue({
            countryCode: selectedCountryCode,
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
            await updatePreferencesAction(valuesToFormData(result.object));
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
