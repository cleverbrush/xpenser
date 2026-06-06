'use client';

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import { FieldLimits, LoginBodySchema } from '@xpenser/contracts';
import { Button, FieldError, FieldGroup } from '@xpenser/ui';
import { type FormEvent, useState } from 'react';
import { loginAction } from '@/lib/actions';
import { isNextRedirectError, valuesToFormData } from './form-utils';
import { ResendEmailConfirmationForm } from './resend-email-confirmation-form';

export function LoginForm({
    redirectTo
}: {
    readonly redirectTo?: string;
} = {}) {
    const form = useSchemaForm(LoginBodySchema);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const result = await form.submit();
        if (!result.valid || !result.object) {
            return;
        }

        setPending(true);
        setError(null);
        setUnverifiedEmail(null);
        try {
            const response = await loginAction(
                valuesToFormData({ ...result.object, redirectTo })
            );
            if (response && 'error' in response && response.error) {
                setError(response.error);
                setUnverifiedEmail(
                    'unverifiedEmail' in response
                        ? (response.unverifiedEmail ?? null)
                        : null
                );
            }
        } catch (caught) {
            if (isNextRedirectError(caught)) {
                throw caught;
            }
            setError('Could not sign in. Check your email and password.');
        } finally {
            setPending(false);
        }
    }

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
