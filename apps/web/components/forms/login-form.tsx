'use client';

import { useSchemaForm } from '@cleverbrush/react-form';
import { FieldLimits, LoginBodySchema } from '@xpenser/contracts';
import { Button, FieldError, FieldGroup } from '@xpenser/ui';
import { useState } from 'react';
import { SchemaField } from '@/components/forms/schema-fields';
import { loginAction } from '@/lib/actions';
import { isNextRedirectError, valuesToFormData } from './form-utils';
import { ResendEmailConfirmationForm } from './resend-email-confirmation-form';

export function LoginForm({
    redirectTo
}: {
    readonly redirectTo?: string;
} = {}) {
    const form = useSchemaForm(LoginBodySchema);
    const { submitting: pending, error } = form;
    const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

    const handleSubmit = form.handleSubmit(
        async values => {
            setUnverifiedEmail(null);
            const response = await loginAction(
                valuesToFormData({ ...values, redirectTo })
            );
            if (response && 'error' in response && response.error) {
                setUnverifiedEmail(
                    'unverifiedEmail' in response
                        ? (response.unverifiedEmail ?? null)
                        : null
                );
                return { ok: false, error: response.error };
            }
            return { ok: true };
        },
        {
            onError: caught => {
                if (isNextRedirectError(caught)) throw caught;
                return 'Could not sign in. Check your email and password.';
            }
        }
    );

    return (
        <div className="flex flex-col gap-4">
            <form noValidate onSubmit={handleSubmit}>
                <FieldGroup>
                    {redirectTo ? (
                        <input
                            name="redirectTo"
                            type="hidden"
                            value={redirectTo}
                        />
                    ) : null}
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
                    <SchemaField
                        fieldProps={{
                            autoComplete: 'current-password',
                            maxLength: FieldLimits.password
                        }}
                        forProperty={field => field.password}
                        form={form}
                        label="Password"
                        name="password"
                        variant="password"
                    />
                    {error ? (
                        <FieldError role="alert">{error}</FieldError>
                    ) : null}
                    <Button className="w-full" disabled={pending} type="submit">
                        {pending ? 'Signing in...' : 'Sign in'}
                    </Button>
                </FieldGroup>
            </form>
            {unverifiedEmail ? (
                <ResendEmailConfirmationForm initialEmail={unverifiedEmail} />
            ) : null}
        </div>
    );
}
