'use client';

import { useSchemaForm } from '@cleverbrush/react-form';
import {
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
import { useEffect, useMemo } from 'react';
import { SchemaField } from '@/components/forms/schema-fields';
import { updatePreferencesAction } from '@/lib/actions';
import { countryLabel, supportedCountries } from '@/lib/countries';
import { supportedTimeZones, timeZoneLabel } from '@/lib/timezones';
import { isNextRedirectError, valuesToFormData } from './form-utils';

export function PreferencesForm({ me }: { readonly me: UserPreference }) {
    const form = useSchemaForm(UpdateUserPreferenceBodySchema);
    const { submitting: pending, error } = form;
    const timeZones = useMemo(() => supportedTimeZones(), []);
    const countries = useMemo(() => supportedCountries(), []);

    useEffect(() => {
        form.reset({
            countryCode: me.countryCode,
            timezone: me.timezone,
            weeklyEmailReportEnabled: me.weeklyEmailReportEnabled,
            monthlyEmailReportEnabled: me.monthlyEmailReportEnabled
        });
    }, [
        form,
        me.countryCode,
        me.monthlyEmailReportEnabled,
        me.timezone,
        me.weeklyEmailReportEnabled
    ]);

    const handleSubmit = form.handleSubmit(
        async values => {
            await updatePreferencesAction(valuesToFormData(values));
        },
        {
            onError: caught => {
                if (isNextRedirectError(caught)) throw caught;
                return 'Could not save preferences.';
            }
        }
    );

    return (
        <form noValidate onSubmit={handleSubmit}>
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input id="email" readOnly value={me.email} />
                </Field>
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
                <Field>
                    <div className="flex flex-col gap-1">
                        <FieldLabel>Email reports</FieldLabel>
                        <FieldDescription>
                            Receive spending and income analytics by email.
                        </FieldDescription>
                    </div>
                    <div className="grid gap-3 rounded-md border border-input p-3">
                        <SchemaField
                            fieldProps={{
                                description:
                                    'Sent Monday morning for the previous week.'
                            }}
                            forProperty={field =>
                                field.weeklyEmailReportEnabled
                            }
                            form={form}
                            label="Weekly report"
                            variant="checkbox"
                        />
                        <SchemaField
                            fieldProps={{
                                description:
                                    'Sent on the first morning of each month.'
                            }}
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
