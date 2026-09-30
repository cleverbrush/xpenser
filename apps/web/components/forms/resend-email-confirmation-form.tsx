'use client';

import { useSchemaForm } from '@cleverbrush/react-form';
import { ResendEmailConfirmationBodySchema } from '@xpenser/contracts';
import { Button, FieldError, FieldGroup, toast } from '@xpenser/ui';
import { useEffect } from 'react';
import { resendEmailConfirmationAction } from '@/lib/actions';
import { valuesToFormData } from './form-utils';
import { SchemaField } from './schema-fields';
import { submissionError } from './submission-error';

export function ResendEmailConfirmationForm({
    initialEmail = ''
}: {
    readonly initialEmail?: string;
}) {
    const form = useSchemaForm(ResendEmailConfirmationBodySchema);
    useEffect(() => {
        form.reset({ email: initialEmail });
    }, [form, initialEmail]);
    return (
        <form
            noValidate
            onSubmit={form.handleSubmit(
                values =>
                    resendEmailConfirmationAction(valuesToFormData(values)),
                {
                    onSuccess: data => {
                        if (data) toast.success(data.message);
                    },
                    onError: submissionError(
                        'Could not send a confirmation link.'
                    )
                }
            )}
        >
            <FieldGroup>
                <SchemaField
                    form={form}
                    forProperty={t => t.email}
                    label="Email"
                    name="resend-email"
                    variant="email"
                    fieldProps={{ autoComplete: 'email' }}
                />
                {form.error ? (
                    <FieldError role="alert">{form.error}</FieldError>
                ) : null}
                <Button
                    disabled={form.submitting}
                    type="submit"
                    variant="outline"
                >
                    {form.submitting ? 'Sending...' : 'Send link'}
                </Button>
            </FieldGroup>
        </form>
    );
}
