'use client';

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import { LoginBodySchema } from '@xpenser/contracts';
import { Button, FieldError, FieldGroup } from '@xpenser/ui';
import { type FormEvent, useState } from 'react';
import { loginAction } from '@/lib/actions';
import { isNextRedirectError, valuesToFormData } from './form-utils';

export function LoginForm() {
    const form = useSchemaForm(LoginBodySchema);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const result = await form.submit();
        if (!result.valid || !result.object) {
            return;
        }

        setPending(true);
        setError(null);
        try {
            await loginAction(valuesToFormData(result.object));
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
        <form noValidate onSubmit={handleSubmit}>
            <FieldGroup>
                <SchemaField
                    fieldProps={{ autoComplete: 'email' }}
                    forProperty={field => field.email}
                    form={form}
                    label="Email"
                    name="email"
                    variant="email"
                />
                <SchemaField
                    fieldProps={{ autoComplete: 'current-password' }}
                    forProperty={field => field.password}
                    form={form}
                    label="Password"
                    name="password"
                    variant="password"
                />
                {error ? <FieldError role="alert">{error}</FieldError> : null}
                <Button className="w-full" disabled={pending} type="submit">
                    {pending ? 'Signing in...' : 'Sign in'}
                </Button>
            </FieldGroup>
        </form>
    );
}
